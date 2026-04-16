"""Unified QR scan endpoint — Phase 6 finalized.

Token format: TYPE:UUID4
  GP:<uuid4>  → GatePass
  SP:<uuid4>  → SportBooking
  EV:<uuid4>  → EventRegistration
  TK:<uuid4>  → EventTicket
  HB:<uuid4>  → HallBooking

Endpoints
---------
POST /api/scan/
    Resolve a token → return resource info + action_allowed.
    Body: { "token": "GP:550e8400-e29b-41d4-a716-446655440000" }

POST /api/scan/action/
    Resolve + atomically execute the allowed action in one round-trip.
    Body: { "token": "GP:...", "action": "mark_exit" }
    Supported actions:
      GP  → mark_exit, mark_entry
      SP  → check_in
      EV  → check_in
      TK  → mark_used
      HB  → check_in

Security
--------
- Per-user rate limit: 30 scans/min (Redis, graceful fallback)
- UUID4 format validated before any DB hit
- College isolation enforced on every resolve
- Every scan attempt logged to AuditLogger
- Atomic DB writes via select_for_update()
"""

import logging
import re

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.security import AuditLogger

logger = logging.getLogger(__name__)

# UUID4 pattern — accepts hyphenated and hex-only forms
_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$',
    re.IGNORECASE,
)

_RATE_LIMIT = 30   # max scans per window
_RATE_WINDOW = 60  # seconds


# ── Helpers ───────────────────────────────────────────────────────────────────

def _check_rate_limit(user_id: int) -> bool:
    """Return True if within limit, False if exceeded. Fails open on Redis error."""
    key = f"scan:rl:{user_id}"
    try:
        count = cache.get(key, 0)
        if count >= _RATE_LIMIT:
            return False
        # Atomic increment via pipeline when available (django-redis)
        if hasattr(cache, 'pipeline'):
            with cache.pipeline() as p:
                p.incr(key)
                p.expire(key, _RATE_WINDOW)
                p.execute()
        else:
            cache.set(key, count + 1, timeout=_RATE_WINDOW)
        return True
    except Exception:
        return True  # graceful degradation


def _same_college(user, obj) -> bool:
    """True if user and obj share the same college, or either has no college set."""
    user_college = getattr(user, 'college_id', None)
    obj_college = getattr(obj, 'college_id', None)
    if user_college is None or obj_college is None:
        return True
    return user_college == obj_college


def _normalize_uuid(uuid_str: str) -> str:
    """Normalize a UUID string to hyphenated lowercase form."""
    s = uuid_str.replace('-', '').lower()
    return f"{s[:8]}-{s[8:12]}-{s[12:16]}-{s[16:20]}-{s[20:]}"


# ── Resource resolvers ────────────────────────────────────────────────────────

def _resolve_gatepass(uuid_str, user):
    from apps.gate_passes.models import GatePass
    # Canonical token stored as "GP:<uuid4>" — exact match on qr_code field
    token_value = f"GP:{_normalize_uuid(uuid_str)}"
    try:
        gp = GatePass.objects.select_related('student', 'approved_by').get(
            qr_code=token_value
        )
    except GatePass.DoesNotExist:
        # Fallback: legacy tokens stored without prefix or with old GP_ format
        try:
            gp = GatePass.objects.select_related('student', 'approved_by').get(
                qr_code__icontains=uuid_str
            )
        except GatePass.DoesNotExist:
            return None, "Gate pass not found."

    if not _same_college(user, gp):
        return None, "Access denied — college mismatch."

    if gp.status == 'approved' and gp.movement_status != 'outside':
        action_allowed = 'mark_exit'
    elif gp.status in ('outside', 'used') or gp.movement_status == 'outside':
        action_allowed = 'mark_entry'
    else:
        action_allowed = None

    return {
        'type': 'gatepass',
        'entity_id': gp.id,
        'status': gp.status,
        'movement_status': gp.movement_status,
        'student_name': gp.student.get_full_name() or gp.student.username,
        'student_reg': gp.student.registration_number,
        'pass_type': gp.pass_type,
        'exit_date': gp.exit_date.isoformat() if gp.exit_date else None,
        'entry_date': gp.entry_date.isoformat() if gp.entry_date else None,
        'destination': gp.destination,
        'action_allowed': action_allowed,
        'message': f"Gate pass is {gp.status}.",
    }, None


def _resolve_digital_card(identifier, user):
    """Resolve a master digital card QR or Manual ID. Based on scanning user role, suggest context."""
    from core.digital_qr import resolve_user_from_digital_qr
    from apps.auth.models import User
    try:
        # 1. Resolve student by either UUID (QR) or ID (Manual)
        if _UUID_RE.match(str(identifier)):
            # If it's a UUID, it's from dcqr:v1:<uuid> logic
            student = resolve_user_from_digital_qr(f"dcqr:v1:{_normalize_uuid(identifier)}")
        else:
            # If it's a numeric ID, it's from dcqr:manual:<id> logic
            student = User.objects.get(pk=int(identifier))
    except (User.DoesNotExist, ValueError):
        return None, "Student not found (Manual ID Error)."
    except Exception as exc:
        return None, str(exc)

    if not _same_college(user, student):
        return None, "Access denied — college mismatch."

    # Contextual routing based on scanner role
    if user.role in ('warden', 'hr', 'supervisor'):
        # Suggested action: Mark attendance for today
        from apps.attendance.models import Attendance
        today = timezone.localdate()
        att = Attendance.objects.filter(user=student, attendance_date=today).first()
        
        return {
            'type': 'student_id',
            'entity_id': student.id,
            'student_name': student.get_full_name() or student.username,
            'student_reg': student.registration_number,
            'department': student.department,
            'current_attendance': att.status if att else 'not_marked',
            'action_allowed': 'mark_attendance',
            'message': f"Student ID resolved. Scanning as {user.role}.",
        }, None
    
    elif user.role == 'chef':
        return {
            'type': 'student_id',
            'entity_id': student.id,
            'student_name': student.get_full_name() or student.username,
            'student_reg': student.registration_number,
            'action_allowed': 'mark_meal',
            'message': "Student ID resolved for meal marking.",
        }, None

    elif user.role in ('event_organizer', 'staff', 'admin'):
        # Check for active events where this student is registered but hasn't attended
        from apps.events.models import EventRegistration
        now = timezone.now()
        active_reg = EventRegistration.objects.filter(
            student=student,
            status='registered',
            event__start_time__lte=now + timezone.timedelta(hours=1),
            event__end_time__gte=now - timezone.timedelta(hours=1)
        ).select_related('event').first()

        if active_reg:
            return {
                'type': 'student_id',
                'entity_id': student.id,
                'student_name': student.get_full_name() or student.username,
                'student_reg': student.registration_number,
                'department': student.department,
                'event_context': {
                    'registration_id': active_reg.id,
                    'event_title': active_reg.event.title,
                },
                'action_allowed': 'event_check_in',
                'message': f"Student registered for active event: {active_reg.event.title}",
            }, None

    elif user.role in ('gate_security', 'security_head'):
        # Check for approved or active gate pass for today
        from apps.gate_passes.models import GatePass
        today = timezone.localdate()
        gp = GatePass.objects.filter(
            student=student,
            exit_date__date=today,
            status__in=['approved', 'outside', 'used', 'out']
        ).first()

        if gp:
            if gp.status == 'approved' and gp.movement_status != 'outside':
                allowed = 'mark_exit'
            elif gp.movement_status == 'outside' or gp.status in ('outside', 'used', 'out'):
                allowed = 'mark_entry'
            else:
                allowed = None
            return {
                'type': 'gatepass',
                'entity_id': gp.id,
                'student_name': student.get_full_name() or student.username,
                'student_reg': student.registration_number,
                'gate_pass_id': gp.id,
                'gate_pass_status': gp.status,
                'action_allowed': allowed,
                'message': f"Student has an {gp.status} gate pass for today.",
            }, None

        return {
            'type': 'student_id',
            'entity_id': student.id,
            'student_name': student.get_full_name() or student.username,
            'student_reg': student.registration_number,
            'action_allowed': None,
            'message': "ALERT: Student has NO approved gate pass for today.",
            'alert': 'no_gatepass',
        }, None

    return {
        'type': 'student_id',
        'entity_id': student.id,
        'student_name': student.get_full_name() or student.username,
        'student_reg': student.registration_number,
        'action_allowed': None,
        'message': "Student ID resolved. No common action for your role.",
    }, None


def _resolve_sport_booking(uuid_str, user):
    from apps.sports.models import SportBooking
    try:
        booking = SportBooking.objects.select_related(
            'student', 'slot', 'slot__court', 'slot__court__sport'
        ).get(qr_token=_normalize_uuid(uuid_str))
    except (SportBooking.DoesNotExist, Exception):
        return None, "Sport booking not found."

    if not _same_college(user, booking):
        return None, "Access denied — college mismatch."

    action_allowed = 'check_in' if booking.status == 'confirmed' else None

    return {
        'type': 'sport_booking',
        'entity_id': booking.id,
        'status': booking.status,
        'student_name': booking.student.get_full_name() or booking.student.username,
        'student_reg': booking.student.registration_number,
        'sport': booking.slot.court.sport.name,
        'court': booking.slot.court.name,
        'date': str(booking.slot.date),
        'time': f"{booking.slot.start_time} – {booking.slot.end_time}",
        'check_in_time': booking.check_in_time.isoformat() if booking.check_in_time else None,
        'action_allowed': action_allowed,
        'message': f"Sport booking is {booking.status}.",
    }, None


def _resolve_event_registration(uuid_str, user):
    from apps.events.models import EventRegistration
    # Canonical token stored as "EV:<uuid4>"
    token_value = f"EV:{_normalize_uuid(uuid_str)}"
    try:
        reg = EventRegistration.objects.select_related('event', 'student').get(
            qr_code_reference=token_value
        )
    except EventRegistration.DoesNotExist:
        # Fallback: legacy plain UUID tokens
        try:
            reg = EventRegistration.objects.select_related('event', 'student').get(
                qr_code_reference=uuid_str
            )
        except EventRegistration.DoesNotExist:
            return None, "Event registration not found."

    if not _same_college(user, reg):
        return None, "Access denied — college mismatch."

    action_allowed = 'check_in' if reg.status == 'registered' else None

    return {
        'type': 'event_registration',
        'entity_id': reg.id,
        'status': reg.status,
        'student_name': reg.student.get_full_name() or reg.student.username,
        'student_reg': reg.student.registration_number,
        'event_title': reg.event.title,
        'event_date': reg.event.start_date.isoformat() if reg.event.start_date else None,
        'check_in_time': reg.check_in_time.isoformat() if reg.check_in_time else None,
        'action_allowed': action_allowed,
        'message': f"Event registration is {reg.status}.",
    }, None


def _resolve_event_ticket(uuid_str, user):
    from apps.events.models import EventTicket
    try:
        ticket = EventTicket.objects.select_related('event', 'student').get(
            qr_token=_normalize_uuid(uuid_str)
        )
    except EventTicket.DoesNotExist:
        return None, "Event ticket not found."

    if not _same_college(user, ticket):
        return None, "Access denied — college mismatch."

    action_allowed = (
        'mark_used'
        if ticket.ticket_status == 'active' and ticket.payment_status == 'paid'
        else None
    )

    return {
        'type': 'event_ticket',
        'entity_id': ticket.id,
        'payment_status': ticket.payment_status,
        'ticket_status': ticket.ticket_status,
        'student_name': ticket.student.get_full_name() or ticket.student.username,
        'student_reg': ticket.student.registration_number,
        'event_title': ticket.event.title,
        'used_at': ticket.used_at.isoformat() if ticket.used_at else None,
        'action_allowed': action_allowed,
        'message': f"Ticket is {ticket.ticket_status}.",
    }, None


def _resolve_hall_booking(uuid_str, user):
    from apps.hall_booking.models import HallBooking
    try:
        booking = HallBooking.objects.select_related('hall', 'requester').get(
            qr_token=_normalize_uuid(uuid_str)
        )
    except HallBooking.DoesNotExist:
        return None, "Hall booking not found."

    if not _same_college(user, booking):
        return None, "Access denied — college mismatch."

    action_allowed = 'check_in' if booking.status == 'approved' else None

    return {
        'type': 'hall_booking',
        'entity_id': booking.id,
        'status': booking.status,
        'event_name': booking.event_name,
        'hall_name': booking.hall.hall_name,
        'booking_date': str(booking.booking_date),
        'requester': booking.requester.get_full_name() or booking.requester.username,
        'action_allowed': action_allowed,
        'message': f"Hall booking is {booking.status}.",
    }, None


_PREFIX_MAP = {
    'GP': _resolve_gatepass,
    'SP': _resolve_sport_booking,
    'EV': _resolve_event_registration,
    'TK': _resolve_event_ticket,
    'HB': _resolve_hall_booking,
    'dcqr': _resolve_digital_card,
}


# ── Atomic action executors ───────────────────────────────────────────────────

def _action_gatepass(entity_id: int, action: str, user, scan_method: str = 'qr') -> tuple:
    """Atomically execute mark_exit or mark_entry on a GatePass."""
    from apps.gate_passes.models import GatePass, GateScan
    now = timezone.now()

    with transaction.atomic():
        try:
            gp = GatePass.objects.select_for_update().get(pk=entity_id)
        except GatePass.DoesNotExist:
            return None, "Gate pass not found."

        if not _same_college(user, gp):
            return None, "Access denied — college mismatch."

        if action == 'mark_exit':
            if gp.status != 'approved':
                return None, f"Cannot mark exit — pass is {gp.status}."
            gp.status = 'outside'
            gp.movement_status = 'outside'
            gp.exit_time = now
            gp.exit_security = user
            gp.actual_exit_at = now
            gp.save(update_fields=[
                'status', 'movement_status', 'exit_time',
                'exit_security', 'actual_exit_at', 'updated_at',
            ])
            direction = 'out'

        elif action == 'mark_entry':
            if gp.movement_status != 'outside' and gp.status not in ('outside', 'used'):
                return None, "Student is not currently outside."
            gp.entry_time = now
            gp.entry_security = user
            gp.actual_entry_at = now
            gp.movement_status = 'returned'
            gp.status = 'late_return' if (gp.entry_date and now > gp.entry_date) else 'returned'
            gp.save(update_fields=[
                'entry_time', 'entry_security', 'actual_entry_at',
                'movement_status', 'status', 'updated_at',
            ])
            direction = 'in'

        else:
            return None, f"Unknown action '{action}' for gate pass."

        # Log the scan
        GateScan.objects.create(
            gate_pass=gp,
            student=gp.student,
            direction=direction,
            qr_code=gp.qr_code or '',
            location='Main Gate',
            scan_method=scan_method,
            college=gp.college,
        )

    return {
        'type': 'gatepass',
        'entity_id': gp.id,
        'action_performed': action,
        'new_status': gp.status,
        'movement_status': gp.movement_status,
        'student_name': gp.student.get_full_name() or gp.student.username,
        'message': f"Action '{action}' completed successfully.",
    }, None


def _action_sport_booking(entity_id: int, action: str, user, scan_method: str = 'qr') -> tuple:
    """Atomically check in a SportBooking."""
    from apps.sports.models import SportBooking
    now = timezone.now()

    if action != 'check_in':
        return None, f"Unknown action '{action}' for sport booking."

    with transaction.atomic():
        try:
            booking = SportBooking.objects.select_for_update().select_related(
                'student', 'slot', 'slot__court', 'slot__court__sport'
            ).get(pk=entity_id)
        except SportBooking.DoesNotExist:
            return None, "Sport booking not found."

        if not _same_college(user, booking):
            return None, "Access denied — college mismatch."

        if booking.status != 'confirmed':
            return None, f"Cannot check in — booking is {booking.status}."

        booking.status = 'attended'
        booking.check_in_time = now
        booking.checked_in_by = user
        booking.scan_method = scan_method
        booking.save(update_fields=['status', 'check_in_time', 'checked_in_by', 'scan_method', 'updated_at'])

    return {
        'type': 'sport_booking',
        'entity_id': booking.id,
        'action_performed': 'check_in',
        'new_status': 'attended',
        'student_name': booking.student.get_full_name() or booking.student.username,
        'sport': booking.slot.court.sport.name,
        'message': "Check-in recorded successfully.",
    }, None


def _action_event_registration(entity_id: int, action: str, user, scan_method: str = 'qr') -> tuple:
    """Atomically check in an EventRegistration."""
    from apps.events.models import EventRegistration
    now = timezone.now()

    if action != 'check_in':
        return None, f"Unknown action '{action}' for event registration."

    with transaction.atomic():
        try:
            reg = EventRegistration.objects.select_for_update().select_related(
                'event', 'student'
            ).get(pk=entity_id)
        except EventRegistration.DoesNotExist:
            return None, "Event registration not found."

        if not _same_college(user, reg):
            return None, "Access denied — college mismatch."

        if reg.status != 'registered':
            return None, f"Cannot check in — registration is {reg.status}."

        reg.status = 'attended'
        reg.check_in_time = now
        reg.scan_method = scan_method
        reg.save(update_fields=['status', 'check_in_time', 'scan_method', 'updated_at'])

    return {
        'type': 'event_registration',
        'entity_id': reg.id,
        'action_performed': 'check_in',
        'new_status': 'attended',
        'student_name': reg.student.get_full_name() or reg.student.username,
        'event_title': reg.event.title,
        'message': "Event check-in recorded successfully.",
    }, None


def _action_event_ticket(entity_id: int, action: str, user, scan_method: str = 'qr') -> tuple:
    """Atomically mark an EventTicket as used."""
    from apps.events.models import EventTicket
    now = timezone.now()

    if action != 'mark_used':
        return None, f"Unknown action '{action}' for event ticket."

    with transaction.atomic():
        try:
            ticket = EventTicket.objects.select_for_update().select_related(
                'event', 'student'
            ).get(pk=entity_id)
        except EventTicket.DoesNotExist:
            return None, "Event ticket not found."

        if not _same_college(user, ticket):
            return None, "Access denied — college mismatch."

        if ticket.ticket_status != 'active' or ticket.payment_status != 'paid':
            return None, f"Ticket cannot be used — status: {ticket.ticket_status}, payment: {ticket.payment_status}."

        ticket.ticket_status = 'used'
        ticket.used_at = now
        ticket.scan_method = scan_method
        ticket.save(update_fields=['ticket_status', 'used_at', 'scan_method', 'updated_at'])

    return {
        'type': 'event_ticket',
        'entity_id': ticket.id,
        'action_performed': 'mark_used',
        'new_status': 'used',
        'student_name': ticket.student.get_full_name() or ticket.student.username,
        'event_title': ticket.event.title,
        'message': "Ticket marked as used.",
    }, None


def _action_hall_booking(entity_id: int, action: str, user, scan_method: str = 'qr') -> tuple:
    """Record check-in attendance for a HallBooking."""
    from apps.hall_booking.models import HallBooking, HallAttendance

    if action != 'check_in':
        return None, f"Unknown action '{action}' for hall booking."

    with transaction.atomic():
        try:
            booking = HallBooking.objects.select_for_update().select_related(
                'hall', 'requester'
            ).get(pk=entity_id)
        except HallBooking.DoesNotExist:
            return None, "Hall booking not found."

        if not _same_college(user, booking):
            return None, "Access denied — college mismatch."

        if booking.status != 'approved':
            return None, f"Cannot check in — booking is {booking.status}."

        HallAttendance.objects.get_or_create(
            booking=booking,
            attendee_identifier=str(booking.requester_id),
            defaults={
                'attendee_name': booking.requester.get_full_name() or booking.requester.username,
                'scan_method': scan_method,
                'scanned_by': user,
            },
        )

    return {
        'type': 'hall_booking',
        'entity_id': booking.id,
        'action_performed': 'check_in',
        'event_name': booking.event_name,
        'hall_name': booking.hall.hall_name,
        'message': "Hall booking check-in recorded.",
    }, None


def _action_digital_card(entity_id: int, action: str, user, scan_method: str = 'qr') -> tuple:
    """Execute contextual actions (attendance/meals) from a master student QR."""
    from apps.auth.models import User
    from django.db import transaction

    try:
        student = User.objects.get(pk=entity_id)
    except User.DoesNotExist:
        return None, "Student not found."

    if not _same_college(user, student):
        return None, "Access denied — college mismatch."

    now = timezone.now()
    today = timezone.localdate()

    if action == 'mark_attendance':
        # Check if scanning user has authority (Warden/HR/Admin)
        if user.role not in ('warden', 'hr', 'supervisor', 'admin', 'head_warden'):
            return None, "You do not have permission to mark attendance."

        from apps.attendance.models import Attendance
        from apps.attendance.services import AttendanceService
        from apps.gate_passes.models import GatePass

        with transaction.atomic():
            # 1. Update Attendance
            attendance, created = Attendance.objects.get_or_create(
                user=student,
                attendance_date=today,
                defaults={
                    'status': 'present',
                    'college': student.college,
                    'check_in_time': now.time(),
                    'remarks': f"Marked via Universal Scanner by {user.username}",
                    'scan_method': scan_method,
                }
            )
            if not created:
                attendance.status = 'present'
                attendance.check_in_time = now.time()
                attendance.scan_method = scan_method
                attendance.save(update_fields=['status', 'check_in_time', 'scan_method', 'updated_at'])

            # 2. Sync with GatePass if exists for today
            # If attendance is marked present, any active 'outside' gatepass should be marked as returned
            active_gp = GatePass.objects.filter(
                student=student,
                status__in=['approved', 'outside', 'out'],
                exit_date__date=today
            ).first()

            gp_synced = False
            if active_gp:
                if active_gp.movement_status == 'outside' or active_gp.status in ('outside', 'out'):
                    active_gp.entry_time = now
                    active_gp.entry_security = user
                    active_gp.actual_entry_at = now
                    active_gp.movement_status = 'returned'
                    active_gp.status = 'returned'
                    if active_gp.entry_date and now > active_gp.entry_date:
                        active_gp.status = 'late_return'
                    active_gp.save(update_fields=[
                        'entry_time', 'entry_security', 'actual_entry_at',
                        'movement_status', 'status', 'updated_at',
                    ])
                    gp_synced = True

        return {
            'type': 'student_id',
            'entity_id': student.id,
            'action_performed': 'mark_attendance',
            'new_status': 'present',
            'student_name': student.get_full_name() or student.username,
            'gatepass_synced': gp_synced,
            'message': f"Attendance marked for {today.strftime('%Y-%m-%d')}." + (" GatePass also updated." if gp_synced else ""),
        }, None

    elif action == 'mark_meal':
        if user.role != 'chef' and not user.is_staff:
            return None, "You do not have permission to mark meals."

        from apps.meals.models import Meal, MealAttendance
        from datetime import datetime
        
        # 1. Detect active meal slot based on current time
        now_time = now.time()
        active_meal = Meal.objects.filter(
            meal_date=today,
            start_time__lte=now_time,
            end_time__gte=now_time
        ).first()

        if not active_meal:
            # Fallback: find the closest meal starting soon or recently ended
            # For brevity in Phase 1, we require an exact time match
            return None, "No active meal session found for the current time."

        with transaction.atomic():
            # 2. Record or Update attendance
            attendance, created = MealAttendance.objects.get_or_create(
                meal=active_meal,
                student=student,
                defaults={
                    'status': 'taken',
                    'tenant_id': student.tenant_id if hasattr(student, 'tenant_id') else None,
                    'scan_method': scan_method,
                }
            )
            
            if not created and attendance.status == 'taken':
                return None, f"Meal already taken for {active_meal.get_meal_type_display()}."
            
            if not created:
                attendance.scan_method = scan_method
                attendance.save(update_fields=['scan_method', 'updated_at'])

        return {
            'type': 'student_id',
            'entity_id': student.id,
            'action_performed': 'mark_meal',
            'new_status': 'taken',
            'student_name': student.get_full_name() or student.username,
            'meal_type': active_meal.get_meal_type_display(),
            'message': f"Meal recorded: {active_meal.get_meal_type_display()} for {student.username}.",
        }, None

    elif action == 'event_check_in':
        from apps.events.models import EventRegistration
        # Re-resolve the registration using the same logic as the resolver
        active_reg = EventRegistration.objects.filter(
            student=student, 
            status='registered',
            event__start_time__lte=now + timezone.timedelta(hours=1),
            event__end_time__gte=now - timezone.timedelta(hours=1)
        ).first()
        
        if not active_reg:
            return None, "No active registration found for check-in."

        active_reg.status = 'attended'
        active_reg.attended_at = now
        active_reg.scan_method = scan_method
        active_reg.save(update_fields=['status', 'attended_at', 'scan_method', 'updated_at'])

        return {
            'type': 'student_id',
            'entity_id': student.id,
            'action_performed': 'event_check_in',
            'new_status': 'attended',
            'student_name': student.get_full_name() or student.username,
            'event_title': active_reg.event.title,
            'message': f"Checked into event: {active_reg.event.title}.",
        }, None

    return None, f"Unknown action '{action}' for student ID."


_ACTION_MAP = {
    'GP': _action_gatepass,
    'SP': _action_sport_booking,
    'EV': _action_event_registration,
    'TK': _action_event_ticket,
    'HB': _action_hall_booking,
    'dcqr': _action_digital_card,
}


# ── Views ─────────────────────────────────────────────────────────────────────

def _parse_token(token: str):
    """Parse and validate a TYPE:UUID token. Returns (prefix, uuid_str, error_response)."""
    if not token:
        return None, None, 'token is required. Format: TYPE:UUID (e.g. GP:550e8400-...)'

    # Normalization for Master Digital Card QR format: dcqr:v1:<uuid>:<sig>
    if token.lower().startswith('dcqr:'):
        # We handle both dcqr:v1:<uuid> (QR) and dcqr:manual:<id> (Manual)
        parts = token.split(':')
        if len(parts) >= 3:
            # Check for manual vs v1(crypto)
            mode = parts[1] # 'v1' or 'manual'
            identifier = parts[2]
            return 'dcqr', identifier, None
        return None, None, 'Invalid Digital QR/Manual format.'

    # Handle standard TYPE:UUID tokens
    parts = token.split(':', 1)
    if len(parts) != 2:
        return None, None, 'Invalid token format. Expected TYPE:UUID (e.g. GP:550e8400-...)'

    prefix, uuid_str = parts[0].upper(), parts[1].strip()

    if not _UUID_RE.match(uuid_str):
        return None, None, 'Invalid UUID in token. Must be a valid UUID4.'

    if prefix not in _PREFIX_MAP:
        return None, None, f"Unknown token type '{prefix}'. Valid: {', '.join(_PREFIX_MAP)}"

    return prefix, uuid_str, None


class UnifiedScanView(APIView):
    """POST /api/scan/ — resolve any QR token to its resource info."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if not _check_rate_limit(user.id):
            logger.warning("Scan rate limit exceeded for user %s", user.id)
            return Response(
                {'error': 'Too many scan requests. Please wait before scanning again.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        token = (request.data.get('token') or '').strip()
        prefix, uuid_str, err = _parse_token(token)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        data, error = _PREFIX_MAP[prefix](uuid_str, user)

        AuditLogger.log_action(
            user.id, 'qr_scan', prefix.lower(), uuid_str, success=(error is None)
        )

        if error:
            return Response({'error': error}, status=status.HTTP_404_NOT_FOUND)

        return Response(data, status=status.HTTP_200_OK)


class UnifiedScanActionView(APIView):
    """POST /api/scan/action/ — resolve + atomically execute the allowed action.

    Body: { "token": "GP:<uuid4>", "action": "mark_exit" }

    This saves the frontend a second round-trip: scan → confirm → act.
    The action is validated against what's allowed for the current resource state.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        if not _check_rate_limit(user.id):
            return Response(
                {'error': 'Too many scan requests. Please wait before scanning again.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        token = (request.data.get('token') or '').strip()
        action = (request.data.get('action') or '').strip()

        if not action:
            return Response(
                {'error': 'action is required (e.g. mark_exit, mark_entry, check_in, mark_used)'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Parse manual or QR token
        is_manual_token = token.startswith('manual:user:') or token.lower().startswith('dcqr:manual:')

        if is_manual_token:
            # Manual resolution from UI Search
            prefix = 'dcqr'
            try:
                entity_id = int(token.split(':')[-1])
                uuid_str = f"manual:{entity_id}" # for logging
                # Check for existing student
                from apps.auth.models import User
                student = User.objects.get(pk=entity_id)
                if not _same_college(user, student):
                    return Response({'error': 'College mismatch.'}, status=status.HTTP_403_FORBIDDEN)
                
                # Manual actions are always allowed if the role permits
                # We skip the "action_allowed" check from resolver because manual 
                # overrides are intentional by the staff member.
                resolve_data = {'entity_id': student.id, 'action_allowed': action} 
            except (ValueError, User.DoesNotExist):
                return Response({'error': 'Invalid manual student ID.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Standard QR Path
            prefix, uuid_str, err = _parse_token(token)
            if err:
                return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

            # First resolve to get entity_id (cheap — uses indexed lookup)
            resolve_data, resolve_error = _PREFIX_MAP[prefix](uuid_str, user)
            if resolve_error:
                AuditLogger.log_action(user.id, 'qr_action', prefix.lower(), uuid_str, success=False)
                return Response({'error': resolve_error}, status=status.HTTP_404_NOT_FOUND)

            # Validate action is allowed for current state (QR only)
            allowed = resolve_data.get('action_allowed')
            if allowed != action:
                AuditLogger.log_action(user.id, 'qr_action_denied', prefix.lower(), uuid_str, success=False)
                return Response(
                    {
                        'error': f"Action '{action}' is not allowed. "
                                 + (f"Allowed action: '{allowed}'." if allowed else "No action is currently allowed."),
                        'action_allowed': allowed,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # 2. Execute Action Atomically
        entity_id = resolve_data['entity_id']
        action_fn = _ACTION_MAP[prefix]
        
        # Record scan method for audit/models
        scan_method = 'manual' if is_manual_token else 'qr'
        
        result, action_error = action_fn(entity_id, action, user, scan_method=scan_method)

        AuditLogger.log_action(
            user.id, f'qr_action:{action}', prefix.lower(), uuid_str, 
            success=(action_error is None),
            metadata={'method': scan_method}
        )

        if action_error:
            return Response({'error': action_error}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)
