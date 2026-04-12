from __future__ import annotations

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.auth.models import User
from apps.colleges.models import College
from apps.rbac.models import Module, Permission, Role, RolePermission


@pytest.mark.django_db
class TestSeedAdminsCommand:
    def test_requires_explicit_passwords_for_new_accounts(self):
        with pytest.raises(CommandError, match='Missing passwords for'):
            call_command('seed_admins')

    def test_creates_accounts_with_explicit_passwords(self):
        output = StringIO()

        call_command(
            'seed_admins',
            superadmin_password='StrongSuperPass123',
            admin_password='StrongAdminPass123',
            stdout=output,
        )

        assert User.objects.get(username='SUPERADMIN').check_password('StrongSuperPass123')
        assert User.objects.get(username='ADMIN').check_password('StrongAdminPass123')

    def test_existing_passwords_are_not_reset_without_flag(self):
        superadmin = User.objects.create_user(
            username='SUPERADMIN',
            registration_number='SA-001',
            email='old-superadmin@example.com',
            password='OriginalPass123',
            role='super_admin',
            is_staff=True,
            is_superuser=True,
        )

        call_command(
            'seed_admins',
            superadmin_password='ReplacementPass123',
            admin_password='StrongAdminPass123',
        )

        superadmin.refresh_from_db()
        assert superadmin.check_password('OriginalPass123')


@pytest.mark.django_db
class TestSetupCoreRolesCommand:
    def test_requires_bootstrap_password_when_creating_accounts(self):
        with pytest.raises(CommandError, match='bootstrap password is required'):
            call_command('setup_core_roles')


@pytest.mark.django_db
class TestSeedRbacCommand:
    def test_verify_passes_after_seed(self):
        output = StringIO()

        call_command('seed_rbac')
        call_command('seed_rbac', verify=True, stdout=output)

        assert 'RBAC verification passed.' in output.getvalue()

    def test_verify_fails_when_permissions_drift(self):
        call_command('seed_rbac')

        role = Role.objects.get(slug='admin')
        module = Module.objects.get(slug='hostel')
        mismatched_permission = Permission.objects.get(slug='view')

        role_permission = RolePermission.objects.get(role=role, module=module)
        role_permission.permission = mismatched_permission
        role_permission.save(update_fields=['permission'])

        with pytest.raises(CommandError, match='RBAC verification failed'):
            call_command('seed_rbac', verify=True)


@pytest.mark.django_db
class TestSeedBulkStudentsCommand:
    def test_fails_for_missing_college(self):
        with pytest.raises(CommandError, match="College 'MISSING' not found"):
            call_command('seed_bulk_students', college_code='MISSING', count=1)

    def test_creates_students_for_college(self):
        college = College.objects.create(
            name='St Mary Test College',
            code='SMG',
            city='Hyderabad',
            state='Telangana',
        )

        call_command(
            'seed_bulk_students',
            college_code='SMG',
            count=4,
            hosteller_ratio=50,
        )

        created = User.objects.filter(
            role='student',
            college=college,
            username__startswith='LOADSTUD',
        ).order_by('username')

        assert created.count() == 4
        assert created.values_list('username', flat=True).distinct().count() == 4
        assert all(user.check_password('Test@1234') for user in created)
        assert created.filter(student_type='hosteller').count() == 2
        assert created.filter(student_type='day_scholar').count() == 2

    def test_additive_runs_append_more_students(self):
        College.objects.create(
            name='St Mary Test College',
            code='SMG',
            city='Hyderabad',
            state='Telangana',
        )

        call_command('seed_bulk_students', college_code='SMG', count=2)
        call_command('seed_bulk_students', college_code='SMG', count=3)

        created = User.objects.filter(
            role='student',
            username__startswith='LOADSTUD',
        )
        assert created.count() == 5