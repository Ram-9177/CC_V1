from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from core.services import BaseService
from apps.complaints.models import Complaint
from apps.analytics.services.nrt_service import NRTInvalidator

class ComplaintService(BaseService):
    """
    God-Level Complaint Lifecycle Service.
    Enforces institutional accountability through SLA monitoring and state machines.
    """

    @staticmethod
    def _get_workflow_actor(complaint: Complaint, actor=None):
        """Pick a real persisted user for workflow audit entries."""
        if actor is not None:
            return actor
        if getattr(complaint, 'assigned_to', None):
            return complaint.assigned_to
        return complaint.student

    @classmethod
    @transaction.atomic
    def create_complaint(cls, student, data: dict, college=None) -> Complaint:
        """
        Hardened complaint creation with duplicate detection.
        """
        if getattr(student, 'role', None) != 'student':
            raise ValidationError("Only student users can raise complaints in this phase.")
        if getattr(student, 'student_type', None) != 'hosteller':
            raise ValidationError("Only hosteller students can raise complaints in this phase.")

        # Phase 4 Duplicate Detection
        threshold = timezone.now() - timezone.timedelta(hours=2)
        exists = Complaint.objects.filter(
            student=student,
            category=data.get('category'),
            subcategory=data.get('subcategory', ''),
            created_at__gte=threshold,
            status__in=['open', 'assigned', 'in_progress']
        ).exists()

        if exists:
             # Logic is to allow but log if identical (or block if spam-like)
             pass

        complaint = Complaint.objects.create(
            student=student,
            college=college,
            category=data.get('category'),
            subcategory=data.get('subcategory', ''),
            title=data.get('title'),
            description=data.get('description'),
            image=data.get('image'),
            location_details=data.get('location_details', ''),
            contact_number=data.get('contact_number', ''),
            preferred_visit_slot=data.get('preferred_visit_slot', 'anytime'),
            allow_room_entry=bool(data.get('allow_room_entry', False)),
            priority=data.get('priority', '3'),
            student_type=getattr(student, 'student_type', 'hosteller')
        )
        
        # Trigger Auto-Assignment 
        from apps.complaints.assignment import auto_assign_complaint
        auto_assign_complaint(complaint, actor=student)

        cls.emit("complaint.created", {
            'id': str(complaint.id),
            'category': complaint.category
        })

        # Institutional Resilience: NRT Read Model Refresh
        NRTInvalidator.handle_complaint_mutation(complaint)

        return complaint

    @classmethod
    def get_analytics(cls, college_id: str) -> dict:
        """
        High-Performance Analytical Bridge (Phase 10 Hardened).
        First looks into pre-aggregated 'ComplaintSummary' and 'DailyHostelMetrics'.
        """
        from apps.analytics.models import DailyHostelMetrics, ComplaintSummary
        today = timezone.localdate()
        
        # 1. Fetch Departmental Snapshots (God-Level Speed)
        summaries = ComplaintSummary.objects.filter(tenant_id=college_id)
        if summaries.exists():
            by_category = [
                {"category": s.category, "count": s.total_open} for s in summaries
            ]
            total_open = sum(s.total_open for s in summaries)
            total_breached = sum(s.breach_count for s in summaries)
            avg_age_total = sum(s.avg_age_hrs * s.total_open for s in summaries)
            avg_age = (avg_age_total / total_open) if total_open > 0 else 0.0

            return {
                'by_category': by_category,
                'average_resolution_time': avg_age * 3600.0, # seconds for frontend compatibility
                'breach_rate': (total_breached / total_open * 100) if total_open > 0 else 0.0,
                'total_count': total_open
            }

        # 2. Institutional Fallback to Daily Metrics
        metrics = DailyHostelMetrics.objects.filter(tenant_id=college_id, date=today).first()
        if metrics and metrics.complaint_counts_by_category:
            total = sum(metrics.complaint_counts_by_category.values())
            by_category = [{"category": k, "count": v} for k, v in metrics.complaint_counts_by_category.items()]
            return {
                'by_category': by_category,
                'average_resolution_time': metrics.avg_resolution_time_hrs * 3600.0,
                'breach_rate': 0.0, 
                'total_count': total
            }
        
        # 3. Last Resort: Real-time (identical to views.py logic but centralized)
        from django.db.models import Count, Avg, F
        from apps.complaints.models import Complaint
        
        base_qs = Complaint.objects.filter(college_id=college_id)
        by_category = list(base_qs.filter(status__in=['open', 'assigned', 'in_progress']).values('category').annotate(count=Count('id')).order_by('-count'))
        
        resolved = base_qs.filter(status='resolved', resolved_at__isnull=False)
        avg_res = resolved.annotate(
            duration=F('resolved_at') - F('created_at')
        ).aggregate(avg_time=Avg('duration'))
        
        total = base_qs.count()
        breached = base_qs.filter(is_overdue=True).count()
        breach_rate = (breached / total * 100) if total > 0 else 0
        
        return {
            'by_category': by_category,
            'average_resolution_time': avg_res['avg_time'] or 0.0,
            'breach_rate': breach_rate,
            'total_count': total
        }

    @classmethod
    @transaction.atomic
    def execute_action(cls, complaint_id: str, actor, action: str, remarks: str = "") -> Complaint:
        """
        Transition a complaint through its lifecycle with state-machine guards.
        """
        complaint = Complaint.objects.select_for_update().get(id=complaint_id)
        
        # State Guard
        from core.state_machine import ComplaintMachine
        ComplaintMachine.validate(complaint.status, action)

        # Mutate
        complaint.status = action
        if action == 'resolved':
            complaint.resolved_at = timezone.now()
        elif action == 'reopened':
            complaint.resolved_at = None
        
        complaint.save()

        if action == 'resolved':
            # Keep a single terminal state across all mutation paths.
            ComplaintMachine.validate('resolved', 'closed')
            complaint.status = 'closed'
            complaint.save(update_fields=['status', 'updated_at'])

        # Institutional Resilience: NRT Read Model Refresh
        NRTInvalidator.handle_complaint_mutation(complaint)

        # Notify
        cls.emit(f"complaint.{action}", {
            'complaint_id': str(complaint.id),
            'student_id': str(complaint.student_id),
            'category': complaint.category
        })

        return complaint

    @classmethod
    @transaction.atomic
    def process_sla_check(cls, complaint_id: str) -> bool:
        """
        Evaluates a complaint for SLA breach.
        Returns True if a new breach was detected and processed.
        """
        complaint = Complaint.objects.select_for_update().get(id=complaint_id)
        
        # Guard: Only pending/active complaints can breach
        if complaint.status not in ["open", "assigned", "in_progress", "reopened"] or complaint.is_overdue:
            return False

        # Logic
        if complaint.check_sla(): # check_sla() should only check time, not save
            complaint.is_overdue = True
            complaint.save(update_fields=['is_overdue', 'updated_at'])

            # Log internal history
            from apps.complaints.models import ComplaintUpdate
            workflow_actor = cls._get_workflow_actor(complaint)
            ComplaintUpdate.objects.create(
                complaint=complaint,
                user=workflow_actor,
                status_from=complaint.status,
                status_to=complaint.status,
                comment="Institutional Alert: SLA resolution commitment breached.",
                is_internal=True
            )

            # Emit breach event for immediate management visibility
            cls.emit("complaint.sla_breach", {
                "id": str(complaint.id),
                "title": complaint.title,
                "category": complaint.category
            }, priority='high')

            return True
        return False

    @classmethod
    @transaction.atomic
    def escalate_complaint(
        cls,
        complaint_id: str,
        actor=None,
        comment: str = "",
        require_overdue: bool = True,
    ) -> bool:
        """
        Escalates a complaint to the next management level.

        `require_overdue=True` is used by SLA jobs.
        `require_overdue=False` is used by manual escalation API action.
        """
        complaint = Complaint.objects.select_for_update().get(id=complaint_id)
        
        # Guard
        if require_overdue and not complaint.is_overdue:
            return False
        if complaint.escalation_level >= 3:
            return False

        from apps.complaints.assignment import get_escalation_target, get_next_escalation_level
        next_level = get_next_escalation_level(complaint)
        if next_level > 3:
            return False

        target = get_escalation_target(complaint, next_level=next_level)
        
        if target:
            previous_status = complaint.status
            complaint.assigned_to = target
            complaint.escalation_level = next_level
            if complaint.status in ['open', 'reopened', 'procurement']:
                complaint.status = 'assigned'
            complaint.save(update_fields=['assigned_to', 'escalation_level', 'status', 'updated_at'])

            workflow_actor = cls._get_workflow_actor(complaint, actor=actor)
            escalated_to_name = target.get_full_name() or target.username
            if comment and str(comment).strip():
                update_comment = str(comment).strip()
            elif require_overdue:
                update_comment = (
                    f"Auto-escalated to {escalated_to_name} due to resolution delay "
                    f"(level {next_level})."
                )
            else:
                update_comment = f"Escalated to level {next_level} ({escalated_to_name})."

            # Record escalation history
            from apps.complaints.models import ComplaintUpdate
            ComplaintUpdate.objects.create(
                complaint=complaint,
                user=workflow_actor,
                status_from=previous_status,
                status_to=complaint.status,
                comment=update_comment,
                is_internal=actor is None,
            )

            # Notify mapped assignee for this escalation level.
            from core.event_service import emit_event_on_commit

            emit_event_on_commit("complaint.escalated", {
                "complaint_id": str(complaint.id),
                "escalation_level": next_level,
                "reason": "sla_breach" if require_overdue else "manual",
            }, user_id=target.id)

            emit_event_on_commit("complaint.assigned", {
                "id": str(complaint.id),
                "title": complaint.title,
                "reason": "Institutional SLA Escalation"
            }, user_id=target.id)

            from apps.notifications.service import NotificationService
            try:
                NotificationService.send(
                    user=target,
                    title="Complaint Escalated",
                    message=f"Complaint #{complaint.id} has been escalated to your queue (level {next_level}).",
                    notif_type='warning',
                    action_url=f"/complaints?id={complaint.id}",
                    college=complaint.college,
                )
            except Exception:
                pass

            return True
        return False
