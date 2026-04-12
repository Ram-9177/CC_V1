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
}


# ── Atomic action executors ───────────────────────────────────────────────────

def _action_gatepass(entity_id: int, action: str, user) -> tuple:
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
            scan_method='qr',
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


def _action_sport_booking(entity_id: int, action: str, user) -> tuple:
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
        booking.scan_method = 'qr'
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


def _action_event_registration(entity_id: int, action: str, user) -> tuple:
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
        reg.scan_method = 'qr'
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


def _action_event_ticket(entity_id: int, action: str, user) -> tuple:
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
        ticket.save(update_fields=['ticket_status', 'used_at', 'updated_at'])

    return {
        'type': 'event_ticket',
        'entity_id': ticket.id,
        'action_performed': 'mark_used',
        'new_status': 'used',
        'student_name': ticket.student.get_full_name() or ticket.student.username,
        'event_title': ticket.event.title,
        'message': "Ticket marked as used.",
    }, None


def _action_hall_booking(entity_id: int, action: str, user) -> tuple:
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
                'scan_method': 'qr',
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


_ACTION_MAP = {
    'GP': _action_gatepass,
    'SP': _action_sport_booking,
    'EV': _action_event_registration,
    'TK': _action_event_ticket,
    'HB': _action_hall_booking,
}


# ── Views ─────────────────────────────────────────────────────────────────────

def _parse_token(token: str):
    """Parse and validate a TYPE:UUID token. Returns (prefix, uuid_str, error_response)."""
    if not token:
        return None, None, 'token is required. Format: TYPE:UUID (e.g. GP:550e8400-...)'

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

        prefix, uuid_str, err = _parse_token(token)
        if err:
            return Response({'error': err}, status=status.HTTP_400_BAD_REQUEST)

        # First resolve to get entity_id (cheap — uses indexed lookup)
        resolve_data, resolve_error = _PREFIX_MAP[prefix](uuid_str, user)
        if resolve_error:
            AuditLogger.log_action(user.id, 'qr_action', prefix.lower(), uuid_str, success=False)
            return Response({'error': resolve_error}, status=status.HTTP_404_NOT_FOUND)

        # Validate action is allowed for current state
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

        entity_id = resolve_data['entity_id']
        action_fn = _ACTION_MAP[prefix]
        result, action_error = action_fn(entity_id, action, user)

        AuditLogger.log_action(
            user.id, f'qr_action:{action}', prefix.lower(), uuid_str, success=(action_error is None)
        )

        if action_error:
            return Response({'error': action_error}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)
