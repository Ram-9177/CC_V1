from django.db import transaction
from django.utils import timezone
from apps.gate_passes.models import GatePass
from apps.gate_passes.selectors.gatepass_selector import get_active_gatepass
from apps.gate_passes.state import GatePassState
from core.services import BaseService

class GatePassService(BaseService):
    """
    Hardened institutional GatePass Service.
    Enforces multi-tenant isolation, state machines, and atomic integrity.
    """

    @classmethod
    @transaction.atomic
    def apply_pass(cls, student, actor, data: dict) -> GatePass:
        """
        Initiates a new gate pass request.
        Handles auto-approval for Day Scholars and institutional guards.
        """
        # 1. State Guard: Only one active/pending pass allowed per session
        from apps.gate_passes.models import GatePass
        from core.exceptions import InvalidTransitionError

        requested_exit = data.get('exit_date')
        requested_entry = data.get('entry_date') or requested_exit
        if requested_exit:
            from apps.leaves.models import LeaveApplication

            request_start = requested_exit.date()
            request_end = requested_entry.date() if requested_entry else request_start
            overlap_leave_exists = LeaveApplication.objects.filter(
                student=student,
                status__in=['APPROVED', 'ACTIVE'],
                start_date__lte=request_end,
                end_date__gte=request_start,
            ).exists()
            if overlap_leave_exists:
                raise InvalidTransitionError(
                    "An approved leave already covers this period. Gate pass is auto-generated during leave approval."
                )
        
        active_passes = GatePass.objects.filter(
            student=student, 
            status__in=["pending", "approved", "out", "outside", "used", "late_return"]
        )
        
        for active_pass in active_passes:
            if active_pass.status in ['approved', 'out']:
                raise InvalidTransitionError(f"Cannot apply: Student already has an active ({active_pass.status}) gate pass.")
            elif active_pass.status == 'pending':
                time_diff = timezone.now() - active_pass.created_at
                # 3 hours = 10800 seconds
                if time_diff.total_seconds() > 10800:
                    active_pass.status = 'rejected'
                    active_pass.approval_remarks = "Auto-rejected: Replaced by a new request after 3 hours."
                    active_pass.save(update_fields=['status', 'approval_remarks', 'updated_at'])
                else:
                    minutes_left = int(180 - (time_diff.total_seconds() / 60))
                    raise InvalidTransitionError(f"Cannot apply: You already have a pending request. Please wait {minutes_left} minutes to apply again.")

        # 2. Institutional Rule: Day Scholar auto-approval
        initial_status = 'pending'
        approved_at = None
        approved_by = None
        approval_remarks = ""

        if student.student_type == 'day_scholar':
            initial_status = 'approved'
            approved_at = timezone.now()
            approved_by = actor if getattr(actor, 'role', '') != 'student' else None # System if student applied for themselves
            approval_remarks = "Auto-approved via institutional Day Scholar protocol."

        # 3. Persistence with Auto-Scoping
        gatepass = GatePass(
            student=student,
            status=initial_status,
            movement_status='inside',
            approved_at=approved_at,
            approved_by=approved_by,
            approval_remarks=approval_remarks,
            **data
        )
        cls.apply_college_scope(gatepass, actor)
        gatepass.save()

        # 4. Event Emission (Async)
        event_name = 'gatepass.created' if initial_status == 'pending' else 'gatepass.approved'
        cls.emit(event_name, {
            'gatepass_id': str(gatepass.id),
            'student_id': str(student.id),
            'status': initial_status
        }, priority='high')

        return gatepass

    @classmethod
    @transaction.atomic
    def approve_pass(cls, gatepass_id: str, warden, remarks: str = "") -> GatePass:
        """
        Warden/Admin approval with State Machine enforcement.
        """
        gatepass = GatePass.objects.select_for_update().get(id=gatepass_id)
        
        # Guard
        GatePassState.validate_transition(gatepass.status, 'approved')

        # Mutate
        gatepass.status = 'approved'
        gatepass.approved_by = warden
        gatepass.approved_at = timezone.now()
        gatepass.approval_remarks = remarks
        gatepass.save(update_fields=['status', 'approved_by', 'approved_at', 'approval_remarks', 'updated_at'])

        # Notify
        cls.emit('gatepass.approved', {
            'gatepass_id': str(gatepass.id),
            'student_id': str(gatepass.student_id),
            'approved_by': warden.get_full_name()
        }, priority='high')

        return gatepass

    @classmethod
    @transaction.atomic
    def reject_pass(cls, gatepass_id: str, warden, remarks: str = "") -> GatePass:
        """
        Warden/Admin rejection with State Machine enforcement.
        """
        gatepass = GatePass.objects.select_for_update().get(id=gatepass_id)

        # Guard
        GatePassState.validate_transition(gatepass.status, 'rejected')

        # Mutate
        gatepass.status = 'rejected'
        gatepass.reject_reason = remarks
        gatepass.save(update_fields=['status', 'reject_reason', 'updated_at'])

        # Notify
        cls.emit('gatepass.rejected', {
            'gatepass_id': str(gatepass.id),
            'student_id': str(gatepass.student_id),
            'rejected_by': warden.get_full_name()
        }, priority='high')

        return gatepass

    @classmethod
    @transaction.atomic
    def mark_exit(cls, gatepass_id: str, security_personnel) -> GatePass:
        """
        Physical exit verification at institutional gates.
        """
        gatepass = GatePass.objects.select_for_update().get(id=gatepass_id)
        
        # State Guard (Must be approved to exit)
        GatePassState.validate_transition(gatepass.status, 'out')

        # Mutate
        gatepass.status = 'out'
        gatepass.movement_status = 'outside'
        gatepass.exit_time = timezone.now()
        gatepass.exit_security = security_personnel
        gatepass.actual_exit_at = gatepass.exit_time # Legacy support
        gatepass.save(update_fields=['status', 'movement_status', 'exit_time', 'exit_security', 'actual_exit_at', 'updated_at'])

        # Notify
        cls.emit('gatepass.out', {
            'gatepass_id': str(gatepass.id),
            'student_id': str(gatepass.student_id),
            'scan_time': gatepass.exit_time.isoformat()
        }, priority='high')

        return gatepass

    @classmethod
    @transaction.atomic
    def mark_entry(cls, gatepass_id: str, security_personnel) -> GatePass:
        """
        Physical entry verification with automated late-return detection.
        """
        gatepass = GatePass.objects.select_for_update().get(id=gatepass_id)
        
        # State Guard (Must be out to enter)
        # Note: In a real system, we might detect late return here for status,
        # but the Machine validates the *legal* transition.
        GatePassState.validate_transition(gatepass.status, 'in')

        now = timezone.now()
        is_late = False
        if gatepass.entry_date and now > gatepass.entry_date:
            is_late = True

        # Mutate
        gatepass.status = 'in'
        gatepass.movement_status = 'returned'
        gatepass.entry_time = now
        gatepass.entry_security = security_personnel
        gatepass.actual_entry_at = now # Legacy support
        gatepass.save(update_fields=['status', 'movement_status', 'entry_time', 'entry_security', 'actual_entry_at', 'updated_at'])

        # Notify
        cls.emit('gatepass.in', {
            'gatepass_id': str(gatepass.id),
            'student_id': str(gatepass.student_id),
            'scan_time': now.isoformat(),
            'is_late': is_late
        }, priority='high')

        # Secondary Side-Effect (Async escalation if late)
        if is_late:
            cls.emit('disciplinary.late_return', {
                'student_id': str(gatepass.student_id),
                'gatepass_id': str(gatepass.id)
            }, priority='urgent')

        return gatepass
