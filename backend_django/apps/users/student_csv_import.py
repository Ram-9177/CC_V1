"""
Bulk user CSV import: students (with Tenant profile) or staff/leadership (User + Django Group).

- **Students:** same columns as UnifiedUserForm (father/address, student_type, year/sem, campus…).
- **Non-student roles:** Super Admin or **Admin** only (Head Warden / Warden cannot import staff via CSV).
- **TenantViewSet** upload: `students_only=True` (students only).

Mirrors `AdminUserCreateSerializer` group mapping. Password default: phone digits `@` same digits;
`is_password_changed=False` until first login change.

Known gaps (optional follow-up): `hostel` FK from CSV, `is_active`/`is_approved` columns, alumni workflows,
college matching by **name** (CSV uses `college_code` only today; add name resolution if exports lack codes).
"""
from __future__ import annotations

import re
from typing import Any, Callable

from django.contrib.auth.models import Group
from django.db import transaction

from apps.auth.models import User
from apps.colleges.models import College
from apps.users.models import Tenant
from core.constants import UserRoles
from core.permissions import (
    user_is_super_admin,
    user_is_top_level_management,
)

MAX_STUDENT_CSV_ROWS = 500

# Same mapping as AdminUserCreateSerializer (keep in sync).
ROLE_TO_AUTH_GROUP_NAME: dict[str, str] = {
    UserRoles.STUDENT: 'Student',
    UserRoles.STAFF: 'Staff',
    UserRoles.ADMIN: 'Admin',
    UserRoles.SUPER_ADMIN: 'Admin',
    UserRoles.PRINCIPAL: 'Principal',
    UserRoles.DIRECTOR: 'Director',
    UserRoles.HOD: 'HOD',
    UserRoles.WARDEN: 'Warden',
    UserRoles.HEAD_WARDEN: 'Head Warden',
    UserRoles.INCHARGE: 'Incharge',
    UserRoles.HR: 'Staff',
    UserRoles.CHEF: 'Chef',
    UserRoles.HEAD_CHEF: 'Chef',
    UserRoles.GATE_SECURITY: 'Gate Security',
    UserRoles.SECURITY_HEAD: 'Security Head',
    UserRoles.PD: 'Sports',
    UserRoles.PT: 'Sports',
    UserRoles.ALUMNI: 'Alumni',
}

_CSV_ROLE_ALIASES = {
    'superadmin': UserRoles.SUPER_ADMIN,
    'super admin': UserRoles.SUPER_ADMIN,
    'head warden': UserRoles.HEAD_WARDEN,
    'head_warden': UserRoles.HEAD_WARDEN,
    'gate security': UserRoles.GATE_SECURITY,
    'security head': UserRoles.SECURITY_HEAD,
    'head chef': UserRoles.HEAD_CHEF,
}

CSV_TEMPLATE_HEADERS = [
    'first_name',
    'last_name',
    'hall_ticket',
    'role',
    'email',
    'phone_number',
    'college_code',
    'student_type',
    'department',
    'year',
    'semester',
    'is_on_campus',
    'custom_location',
    'father_name',
    'father_phone',
    'permanent_address',
    'city',
    'state',
    'pincode',
    'mother_name',
    'mother_phone',
    'guardian_name',
    'guardian_phone',
]

CSV_TEMPLATE_SAMPLE_ROW_STUDENT = [
    'John',
    'Doe',
    'REG12345',
    'student',
    'john@example.com',
    '9876543210',
    'ENG101',
    'hosteller',
    'CSE',
    '2',
    '4',
    'yes',
    '',
    'Mr. Doe',
    '9876543211',
    '123 MG Road, Hyderabad',
    'Hyderabad',
    'Telangana',
    '500001',
    '-',
    '-',
    '-',
    '-',
]

# Second example: staff (use "-" where student-only fields do not apply)
CSV_TEMPLATE_SAMPLE_ROW_WARDEN = [
    'Jane',
    'Smith',
    'WARDEN_JS01',
    'warden',
    'jane.smith@college.edu',
    '9123456789',
    'ENG101',
    '-',
    'Hostel Ops',
    '-',
    '-',
    'yes',
    '',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
    '-',
]

STUDENT_CSV_FIELD_MAP: dict[str, list[str]] = {
    'registration_number': [
        'reg_no',
        'hall_ticket',
        'hall ticket',
        'roll_no',
        'roll no',
        'username',
        'ht no',
        'student hall ticket',
    ],
    'first_name': ['name', 'student_name', 'given_name'],
    'last_name': ['surname', 'family_name'],
    'mobile': [
        'phone_number',
        'phone',
        'phone number',
        'mobile number',
        'student_mobile',
        'stu mobile',
        'student mobile',
    ],
    'email': ['student_email', 'email address'],
    'father_name': [
        'parent_name',
        'f_name',
        'parent name',
        'father name',
        "father's name",
        'fathers name',
    ],
    'father_phone': [
        'parent_phone',
        'f_mobile',
        'parent phone',
        'father phone',
        'father number',
        "father's phone",
        'fathers phone',
    ],
    'mother_name': ['m_name', 'mother name', 'mother_name'],
    'mother_phone': ['m_mobile', 'mother phone', 'mother_phone', 'mother number'],
    'guardian_name': ['guardian_name', 'g_name', 'guardian name'],
    'guardian_phone': [
        'guardian_phone',
        'g_mobile',
        'guardian phone',
        'guardian number',
    ],
    'college_code': ['college', 'college code', 'affiliation code'],
    'student_type': ['student_type', 'student type', 'residency type', 'residency'],
    'role': ['role', 'user_role', 'system role'],
    'department': ['dept', 'stream', 'branch'],
    'year': ['year_of_study', 'study_year', 'academic_year'],
    'semester': ['sem'],
    'is_on_campus': [
        'is_on_campus',
        'on campus',
        'staying on campus',
        'staying_on_campus',
        'campus presence',
        'campus',
    ],
    'custom_location': ['custom location', 'location note'],
    'address': [
        'permanent_address',
        'permanent address',
        'address',
        'full address',
        'residential address',
    ],
}


def normalize_csv_cell(raw: Any) -> str:
    if raw is None:
        return ''
    s = str(raw).strip()
    if s == '-' or s == '—' or s == '–':
        return ''
    return s


def _normalize_row_keys(row: dict) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in row.items():
        if not k:
            continue
        key = k.strip().lower()
        out[key] = normalize_csv_cell(v)
    return out


def _make_get_val(normalized: dict[str, str]) -> Callable[[str], str]:
    def get_val(logical_key: str) -> str:
        if logical_key in normalized:
            return normalized[logical_key]
        for alias in STUDENT_CSV_FIELD_MAP.get(logical_key, []):
            if alias in normalized:
                return normalized[alias]
        return ''

    return get_val


def default_password_from_phone(phone: str) -> str:
    digits = ''.join(c for c in phone if c.isdigit())
    if not digits:
        raise ValueError('Phone is required to build default password')
    return f'{digits}@{digits}'


def parse_student_type(raw: str) -> str:
    s = (raw or '').strip().lower()
    if s in ('day_scholar', 'day scholar', 'dayscholar', 'day-scholar'):
        return 'day_scholar'
    return 'hosteller'


def parse_optional_year(val: str) -> int | None:
    s = (val or '').strip()
    if not s:
        return None
    try:
        y = int(float(s))
    except ValueError:
        return None
    if 1 <= y <= 5:
        return y
    return None


def parse_optional_semester(val: str) -> int | None:
    s = (val or '').strip()
    if not s:
        return None
    try:
        sval = int(float(s))
    except ValueError:
        return None
    if 1 <= sval <= 10:
        return sval
    return None


def parse_is_on_campus(raw: str) -> bool:
    s = (raw or '').strip().lower()
    if s in ('',):
        return True
    if s in ('no', 'n', 'false', '0', 'off'):
        return False
    if s in ('yes', 'y', 'true', '1', 'on'):
        return True
    return True


def normalize_csv_role(raw: str) -> str | None:
    """Return canonical role slug or None if invalid."""
    s = (raw or '').strip().lower().replace(' ', '_')
    if not s:
        return UserRoles.STUDENT
    if s in _CSV_ROLE_ALIASES:
        return _CSV_ROLE_ALIASES[s]
    if s in UserRoles.ALL_ROLES:
        return s
    # try human labels e.g. head_warden already; try without underscore collapse
    collapsed = raw.strip().lower()
    if collapsed in _CSV_ROLE_ALIASES:
        return _CSV_ROLE_ALIASES[collapsed]
    return None


def importer_may_create_role(
    request_user: User,
    target_role: str,
    *,
    students_only: bool,
) -> tuple[bool, str | None]:
    if students_only:
        if target_role != UserRoles.STUDENT:
            return False, 'This endpoint only accepts role=student rows'
        return True, None
    if target_role == UserRoles.STUDENT:
        return True, None
    if user_is_super_admin(request_user) or getattr(request_user, 'is_superuser', False):
        return True, None
    if getattr(request_user, 'role', None) == UserRoles.ADMIN:
        if target_role == UserRoles.SUPER_ADMIN:
            return False, 'Only Super Admin can create super_admin via CSV'
        return True, None
    return False, 'Only Super Admin or Admin can import non-student roles via CSV'


def assert_college_allowed_for_importer(request_user: User, college_obj: College | None) -> None:
    """College admins cannot attach users to another college."""
    if user_is_super_admin(request_user) or getattr(request_user, 'is_superuser', False):
        return
    cid = getattr(request_user, 'college_id', None)
    if getattr(request_user, 'role', None) == UserRoles.ADMIN and cid:
        if not college_obj or college_obj.id != cid:
            raise ValueError('You can only assign users to your own college.')


def validate_bulk_user_csv_rows(
    rows: list[dict],
    request_user: User,
    *,
    students_only: bool = False,
    error_key: str = 'row',
    line_start: int = 2,
    enforce_max_rows: bool = True,
    require_phone: bool = True,
    email_regex: re.Pattern | None = None,
    phone_regex: re.Pattern | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    errors: list[dict[str, Any]] = []
    if enforce_max_rows and len(rows) > MAX_STUDENT_CSV_ROWS:
        errors.append({error_key: 0, 'error': f'Maximum {MAX_STUDENT_CSV_ROWS} rows allowed'})
        return [], errors

    email_re = email_regex or re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')
    phone_re = phone_regex or re.compile(r'^\+?1?\d{9,15}$')

    valid: list[dict[str, Any]] = []
    seen_reg: set[str] = set()
    seen_email: set[str] = set()

    for idx, row in enumerate(rows, start=line_start):
        normalized = _normalize_row_keys(row)
        get_val = _make_get_val(normalized)

        reg_no = get_val('registration_number').upper()
        if not reg_no:
            errors.append({error_key: idx, 'error': 'Missing hall ticket / username'})
            continue
        if reg_no in seen_reg:
            errors.append({error_key: idx, 'error': f'Duplicate in file: {reg_no}'})
            continue
        seen_reg.add(reg_no)

        first_name = get_val('first_name')
        last_name = get_val('last_name')
        if not last_name and first_name:
            parts = first_name.split()
            if len(parts) >= 2:
                first_name = ' '.join(parts[:-1])
                last_name = parts[-1]
        if not first_name:
            errors.append({error_key: idx, 'error': 'Missing first name'})
            continue
        if not last_name:
            errors.append({error_key: idx, 'error': 'Missing last name'})
            continue

        phone = get_val('mobile')
        if require_phone:
            if not phone:
                errors.append({error_key: idx, 'error': 'Missing phone number'})
                continue
            if not phone_re.match(phone):
                errors.append({error_key: idx, 'error': f'Invalid phone number: {phone}'})
                continue

        email = get_val('email')
        if not email:
            errors.append({error_key: idx, 'error': 'Missing email address'})
            continue
        if not email_re.match(email):
            errors.append({error_key: idx, 'error': f'Invalid email: {email}'})
            continue
        el = email.lower()
        if el in seen_email:
            errors.append({error_key: idx, 'error': f'Duplicate email in file: {email}'})
            continue
        seen_email.add(el)

        role_raw = get_val('role').strip().lower() or UserRoles.STUDENT
        role_norm = normalize_csv_role(role_raw)
        if role_norm is None:
            errors.append({error_key: idx, 'error': f'Unknown role: {role_raw}'})
            continue

        ok, msg = importer_may_create_role(request_user, role_norm, students_only=students_only)
        if not ok:
            errors.append({error_key: idx, 'error': msg or 'Not allowed for this role'})
            continue

        password_override = normalize_csv_cell(row.get('password', ''))

        if role_norm == UserRoles.STUDENT:
            stype = parse_student_type(get_val('student_type'))
            college_code = get_val('college_code')
            if college_code and not College.objects.filter(code__iexact=college_code).exists():
                errors.append({error_key: idx, 'error': f'Invalid college code: {college_code}'})
                continue

            department = get_val('department')
            year_raw = get_val('year')
            sem_raw = get_val('semester')
            year_val = parse_optional_year(year_raw)
            sem_val = parse_optional_semester(sem_raw)
            if year_raw.strip() and year_val is None:
                errors.append(
                    {error_key: idx, 'error': f'Invalid year (use 1–5 or leave empty): {year_raw}'}
                )
                continue
            if sem_raw.strip() and sem_val is None:
                errors.append(
                    {
                        error_key: idx,
                        'error': f'Invalid semester (use 1–10 or leave empty): {sem_raw}',
                    }
                )
                continue

            is_on_campus = parse_is_on_campus(get_val('is_on_campus'))
            custom_location = get_val('custom_location')
            if not is_on_campus:
                custom_location = ''

            father_name = get_val('father_name')
            father_phone = get_val('father_phone')
            permanent_address = get_val('address')
            if not father_name:
                errors.append({error_key: idx, 'error': "Missing father's name"})
                continue
            if not father_phone:
                errors.append({error_key: idx, 'error': "Missing father's phone"})
                continue
            if not phone_re.match(father_phone):
                errors.append(
                    {error_key: idx, 'error': f"Invalid father's phone: {father_phone}"}
                )
                continue
            if not permanent_address:
                errors.append({error_key: idx, 'error': 'Missing permanent address'})
                continue

            valid.append(
                {
                    'kind': 'student',
                    'reg_no': reg_no,
                    'first_name': first_name,
                    'last_name': last_name,
                    'phone': phone,
                    'email': email,
                    'student_type': stype,
                    'role': UserRoles.STUDENT,
                    'department': department,
                    'year': year_val,
                    'semester': sem_val,
                    'is_on_campus': is_on_campus,
                    'custom_location': custom_location,
                    'father_name': father_name,
                    'father_phone': father_phone,
                    'mother_name': get_val('mother_name'),
                    'mother_phone': get_val('mother_phone'),
                    'guardian_name': get_val('guardian_name'),
                    'guardian_phone': get_val('guardian_phone'),
                    'address': permanent_address,
                    'city': normalized.get('city', ''),
                    'state': normalized.get('state', ''),
                    'pincode': normalized.get('pincode', ''),
                    'college_code': college_code,
                    'password_override': password_override,
                    'line_no': idx,
                }
            )
        else:
            college_code = get_val('college_code')
            if college_code and not College.objects.filter(code__iexact=college_code).exists():
                errors.append({error_key: idx, 'error': f'Invalid college code: {college_code}'})
                continue
            if role_norm != UserRoles.SUPER_ADMIN and not (college_code or '').strip():
                errors.append(
                    {
                        error_key: idx,
                        'error': 'Missing college_code (required for this role)',
                    }
                )
                continue

            department = get_val('department')
            is_on_campus = parse_is_on_campus(get_val('is_on_campus'))
            custom_location = get_val('custom_location')
            if not is_on_campus:
                custom_location = ''

            valid.append(
                {
                    'kind': 'staff',
                    'reg_no': reg_no,
                    'first_name': first_name,
                    'last_name': last_name,
                    'phone': phone,
                    'email': email,
                    'role': role_norm,
                    'department': department,
                    'is_on_campus': is_on_campus,
                    'custom_location': custom_location,
                    'college_code': college_code,
                    'password_override': password_override,
                    'line_no': idx,
                }
            )

    return valid, errors


def validate_student_csv_rows(
    rows: list[dict],
    request_user: User,
    **kwargs: Any,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Backward-compatible name: students-only when used from TenantViewSet."""
    return validate_bulk_user_csv_rows(
        rows,
        request_user,
        students_only=kwargs.pop('students_only', True),
        **kwargs,
    )


def apply_college_scope_for_row(request_user: User, item: dict[str, Any]) -> None:
    """Mutate item college_code for warden/college scope; raise if unauthorized."""
    if user_is_top_level_management(request_user):
        return
    cid = getattr(request_user, 'college_id', None)
    if not cid:
        return
    warden_code = getattr(getattr(request_user, 'college', None), 'code', None)
    cc = (item.get('college_code') or '').strip()
    wc = (warden_code or '').strip()
    if cc and wc and cc.casefold() != wc.casefold():
        raise ValueError(
            f'Unauthorized college code: {item["college_code"]}. '
            f'You can only upload users for {warden_code}.'
        )
    if not item.get('college_code'):
        item['college_code'] = warden_code or ''


def create_users_from_valid_items(
    request_user: User,
    valid_items: list[dict[str, Any]],
    *,
    error_key: str = 'row',
) -> tuple[int, list[dict[str, Any]], list[dict[str, Any]]]:
    if not valid_items:
        return 0, [], []

    reg_list = [i['reg_no'] for i in valid_items]
    existing_u = set(
        User.objects.filter(username__in=reg_list).values_list('username', flat=True)
    )
    emails_lower = {i['email'].lower() for i in valid_items if i.get('email')}
    existing_e = set(
        User.objects.filter(email__in=list(emails_lower)).values_list('email', flat=True)
    )
    existing_e_lower = {e.lower() for e in existing_e}

    created = 0
    errors: list[dict[str, Any]] = []
    credentials: list[dict[str, str]] = []

    for item in valid_items:
        ln = item['line_no']
        if item['reg_no'] in existing_u:
            errors.append({error_key: ln, 'error': f'User {item["reg_no"]} already exists'})
            continue
        if item['email'].lower() in existing_e_lower:
            errors.append({error_key: ln, 'error': f'Email {item["email"]} already exists'})
            continue

        try:
            apply_college_scope_for_row(request_user, item)
        except ValueError as exc:
            errors.append({error_key: ln, 'error': str(exc)})
            continue

        if item.get('password_override'):
            raw_password = item['password_override']
        else:
            try:
                raw_password = default_password_from_phone(item['phone'])
            except ValueError as exc:
                errors.append({error_key: ln, 'error': str(exc)})
                continue

        kind = item.get('kind', 'student')

        if kind == 'student':
            cc = (item.get('college_code') or '').strip()
            if not cc:
                errors.append(
                    {error_key: ln, 'error': 'Missing college code (required for students)'}
                )
                continue
            college_obj = College.objects.filter(code__iexact=cc).first()
            if not college_obj:
                errors.append({error_key: ln, 'error': f'Invalid college code: {cc}'})
                continue
            try:
                assert_college_allowed_for_importer(request_user, college_obj)
            except ValueError as exc:
                errors.append({error_key: ln, 'error': str(exc)})
                continue

            dept = (item.get('department') or '').strip()
            student_group, _ = Group.objects.get_or_create(name='Student')

            try:
                with transaction.atomic():
                    user = User.objects.create_user(
                        username=item['reg_no'],
                        registration_number=item['reg_no'],
                        first_name=item['first_name'],
                        last_name=item.get('last_name') or '',
                        email=item['email'],
                        phone_number=item['phone'],
                        password=raw_password,
                        role=UserRoles.STUDENT,
                        student_type=item.get('student_type') or 'hosteller',
                        college=college_obj,
                        department=dept,
                        year=item.get('year'),
                        semester=item.get('semester'),
                        is_on_campus=bool(item.get('is_on_campus', True)),
                        custom_location=item.get('custom_location') or '',
                        is_active=True,
                        is_approved=True,
                        is_password_changed=False,
                    )
                    user.groups.add(student_group)
                    Tenant.objects.create(
                        user=user,
                        father_name=item['father_name'],
                        father_phone=item['father_phone'],
                        mother_name=item['mother_name'],
                        mother_phone=item['mother_phone'],
                        guardian_name=item['guardian_name'],
                        guardian_phone=item['guardian_phone'],
                        address=item['address'],
                        city=item['city'],
                        state=item['state'],
                        pincode=item['pincode'],
                        college_code=cc or None,
                        department=dept,
                    )
                    created += 1
                    credentials.append({'username': item['reg_no'], 'password': raw_password})
            except Exception as exc:  # noqa: BLE001
                errors.append({error_key: ln, 'error': str(exc), 'username': item['reg_no']})
        else:
            role = item['role']
            cc = (item.get('college_code') or '').strip()
            college_obj = None
            if cc:
                college_obj = College.objects.filter(code__iexact=cc).first()
                if not college_obj:
                    errors.append({error_key: ln, 'error': f'Invalid college code: {cc}'})
                    continue
            elif role != UserRoles.SUPER_ADMIN:
                errors.append({error_key: ln, 'error': 'Missing college code'})
                continue

            try:
                assert_college_allowed_for_importer(request_user, college_obj)
            except ValueError as exc:
                errors.append({error_key: ln, 'error': str(exc)})
                continue

            group_name = ROLE_TO_AUTH_GROUP_NAME.get(role, 'Staff')
            group, _ = Group.objects.get_or_create(name=group_name)
            dept = (item.get('department') or '').strip()

            try:
                with transaction.atomic():
                    user = User.objects.create_user(
                        username=item['reg_no'],
                        registration_number=item['reg_no'],
                        first_name=item['first_name'],
                        last_name=item.get('last_name') or '',
                        email=item['email'],
                        phone_number=item['phone'],
                        password=raw_password,
                        role=role,
                        student_type='hosteller',
                        college=college_obj,
                        department=dept,
                        year=None,
                        semester=None,
                        is_on_campus=bool(item.get('is_on_campus', True)),
                        custom_location=item.get('custom_location') or '',
                        is_active=True,
                        is_approved=True,
                        is_password_changed=False,
                    )
                    user.groups.add(group)
                    if role in (UserRoles.ADMIN, UserRoles.SUPER_ADMIN):
                        user.is_staff = True
                    if role == UserRoles.SUPER_ADMIN:
                        user.is_superuser = True
                    user.save(update_fields=['is_staff', 'is_superuser'])
                    created += 1
                    credentials.append({'username': item['reg_no'], 'password': raw_password})
            except Exception as exc:  # noqa: BLE001
                errors.append({error_key: ln, 'error': str(exc), 'username': item['reg_no']})

    return created, errors, credentials


def create_students_from_valid_items(*args: Any, **kwargs: Any) -> Any:
    return create_users_from_valid_items(*args, **kwargs)


def write_student_csv_template(writer) -> None:
    writer.writerow(CSV_TEMPLATE_HEADERS)
    writer.writerow(CSV_TEMPLATE_SAMPLE_ROW_STUDENT)
    writer.writerow(CSV_TEMPLATE_SAMPLE_ROW_WARDEN)
