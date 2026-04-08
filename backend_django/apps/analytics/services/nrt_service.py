"""
apps/analytics/services/nrt_service.py
======================================
Near-Real-Time (NRT) Read Model Inactivator and Partial Hydration.

This service eliminates the 15-30 minute "Visibility Gap" by performing 
targeted, low-cost updates to analytical read models immediately after 
critical state mutations.
"""

from django.db import transaction
from django.utils import timezone
from typing import Optional
from apps.analytics.models import DailyHostelMetrics, ComplaintSummary, DashboardSummary
from apps.auth.models import User

class NRTInvalidator:
    """
    Orchestrates targeted analytical updates triggered by event signals.
    Ensures the Principal's Command Center reflects the 'Institutional Truth' in <2s.
    """

    OUTSIDE_STATUSES = {'out', 'outside', 'used'}

    @classmethod
    def _is_outside(cls, status: Optional[str]) -> bool:
        return (status or '').lower() in cls.OUTSIDE_STATUSES

    @classmethod
    def handle_gatepass_mutation(cls, gatepass, previous_status=None):
        """
        Calculates impact of a single gatepass change on global metrics.
        Triggered on: Exit, Return, Reject, Approve.
        """
        tenant_id = gatepass.tenant_id or (str(gatepass.college_id) if getattr(gatepass, 'college_id', None) else None)
        if not tenant_id:
            return

        today = timezone.now().date()

        # Update DailyHostelMetrics (Atomic increment/decrement)
        with transaction.atomic():
            metrics = (
                DailyHostelMetrics.objects
                .select_for_update()
                .filter(tenant_id=tenant_id, date=today)
                .first()
            )
            if metrics is None:
                total_students = 0
                if getattr(gatepass, 'college_id', None):
                    total_students = User.objects.filter(
                        role='student',
                        is_active=True,
                        college_id=gatepass.college_id,
                    ).count()
                metrics = DailyHostelMetrics.objects.create(
                    tenant_id=tenant_id,
                    date=today,
                    total_students=total_students,
                    students_present=total_students,
                    students_outside=0,
                )

            was_outside = cls._is_outside(previous_status)
            is_outside = cls._is_outside(gatepass.status)

            if is_outside and not was_outside:
                metrics.students_outside += 1
                metrics.students_present = max(0, metrics.students_present - 1)
            elif was_outside and not is_outside:
                metrics.students_outside = max(0, metrics.students_outside - 1)
                metrics.students_present += 1

            # Keep counters safe for PositiveIntegerField constraints.
            metrics.students_outside = max(0, metrics.students_outside)
            metrics.students_present = max(0, metrics.students_present)

            if metrics.total_students == 0 and getattr(gatepass, 'college_id', None):
                metrics.total_students = User.objects.filter(
                    role='student',
                    is_active=True,
                    college_id=gatepass.college_id,
                ).count()

            if metrics.total_students:
                metrics.students_present = min(metrics.students_present, metrics.total_students)

            metrics.save(update_fields=['students_outside', 'students_present', 'total_students'])

        # Invalidate DashboardSummary for this tenant/role
        cls.invalidate_dashboard_cache(tenant_id)

    @classmethod
    def handle_complaint_mutation(cls, complaint):
        """
        Updates departmental snapshots immediately upon complaint resolution or breach.
        """
        tenant_id = complaint.tenant_id
        category = complaint.category

        with transaction.atomic():
            summary, _ = ComplaintSummary.objects.get_or_create(
                tenant_id=tenant_id,
                category=category
            )
            # Update counters
            if complaint.status == 'open':
                summary.total_open += 1
            elif complaint.status == 'closed':
                summary.total_open = max(0, summary.total_open - 1)
            
            summary.save(update_fields=['total_open'])

        cls.invalidate_dashboard_cache(tenant_id)

    @classmethod
    def invalidate_dashboard_cache(cls, tenant_id):
        """
        Marks DashboardSummary entries as expired to force re-hydration 
        on the next request, or triggers a background re-hydration.
        """
        DashboardSummary.objects.filter(
            tenant_id=tenant_id,
            expires_at__gt=timezone.now()
        ).update(expires_at=timezone.now())
