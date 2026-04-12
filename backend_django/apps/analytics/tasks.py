from django.utils import timezone
from .models import DailyHostelMetrics
from apps.auth.models import User
from apps.gate_passes.models import GatePass
from apps.complaints.models import Complaint
from django.db.models import Count, Q
import logging

from core.celery_tasks import resilient_shared_task

logger = logging.getLogger(__name__)

@resilient_shared_task(name="apps.analytics.tasks.refresh_daily_metrics", max_retries=3)
def refresh_daily_metrics(self):
    """
    High-Performance Institutional Metrics Aggregator.
    Runs every 30 minutes to populate pre-aggregated tables.
    """
    try:
        today = timezone.localdate()
        logger.info(f"[Analytics] Starting metric aggregation for {today}...")

        # We iterate by tenant (college) to ensure isolation
        from apps.auth.models import College
        from django.db.models import Avg, F

        colleges = College.objects.all()

        for college in colleges:
            tenant_id = str(college.id)

            total_students = User.objects.filter(college_id=tenant_id, role='student', is_active=True).count()

            gp_today = GatePass.objects.filter(college_id=tenant_id, created_at__date=today)
            issued = gp_today.count()
            late_returns = gp_today.filter(status='late_return').count()
            outside = GatePass.objects.filter(college_id=tenant_id, movement_status='outside').count()

            complaint_qs = Complaint.objects.filter(college_id=tenant_id)
            cat_counts = complaint_qs.filter(
                status__in=['open', 'assigned', 'in_progress', 'reopened']
            ).values('category').annotate(count=Count('id'))
            category_map = {item['category']: item['count'] for item in cat_counts}

            resolved_recent = complaint_qs.filter(
                status='resolved',
                resolved_at__gte=timezone.now() - timezone.timedelta(days=30),
                resolved_at__isnull=False
            )
            avg_res_time = resolved_recent.annotate(
                duration=F('resolved_at') - F('created_at')
            ).aggregate(avg=Avg('duration'))['avg']

            avg_hrs = (avg_res_time.total_seconds() / 3600.0) if avg_res_time else 0.0

            DailyHostelMetrics.objects.update_or_create(
                date=today,
                tenant_id=tenant_id,
                defaults={
                    'total_students': total_students,
                    'students_outside': outside,
                    'gate_passes_issued': issued,
                    'late_returns_detected': late_returns,
                    'complaint_counts_by_category': category_map,
                    'avg_resolution_time_hrs': avg_hrs,
                    'updated_at': timezone.now()
                }
            )

        return {"status": "success", "processed_colleges": colleges.count()}
    except Exception as exc:
        self.retry_with_context(exc, context='refresh_daily_metrics')


@resilient_shared_task(name="apps.analytics.tasks.refresh_read_models", max_retries=3)
def refresh_read_models(self):
    """
    God-Level Read Model Hydrator.
    Flatten expensive JOINs for ultra-fast list views.
    """
    try:
        from apps.auth.models import College
        from .models import DashboardSummary, GatePassListView, ComplaintSummary
        from apps.gate_passes.models import GatePass
        from apps.complaints.models import Complaint
        from django.db.models import Avg, F

        colleges = College.objects.all()
        now = timezone.now()
        expiry = now + timezone.timedelta(minutes=15)

        for college in colleges:
            tenant_id = str(college.id)

            active_gps = GatePass.objects.filter(
                college_id=tenant_id,
                status__in=['approved', 'out']
            ).select_related('student', 'student__room_allocations__room__building')

            for gp in active_gps:
                room_str = "No Room"
                alloc = gp.student.room_allocations.filter(end_date__isnull=True).first()
                if alloc and alloc.room:
                    room_str = f"{alloc.room.building.name}-{alloc.room.floor}-{alloc.room.number}"

                GatePassListView.objects.update_or_create(
                    gatepass_id=gp.id,
                    tenant_id=tenant_id,
                    defaults={
                        'student_name': gp.student.get_full_name(),
                        'registration_num': gp.student.registration_number,
                        'room_info': room_str,
                        'status': gp.status,
                        'exit_date': gp.exit_date
                    }
                )

            comp_stats = Complaint.objects.filter(college_id=tenant_id).values('category').annotate(
                total_open=Count('id', filter=Q(status__in=['open', 'assigned', 'in_progress'])),
                avg_age=Avg(now - F('created_at')),
                breaches=Count('id', filter=Q(is_overdue=True))
            )

            for stat in comp_stats:
                avg_hrs = (stat['avg_age'].total_seconds() / 3600.0) if stat['avg_age'] else 0.0
                ComplaintSummary.objects.update_or_create(
                    tenant_id=tenant_id,
                    category=stat['category'],
                    defaults={
                        'total_open': stat['total_open'],
                        'avg_age_hrs': avg_hrs,
                        'breach_count': stat['breaches']
                    }
                )

            summary_data = {
                "critical_metrics": {
                    "active_students_outside": GatePass.objects.filter(college_id=tenant_id, status='out').count(),
                    "pending_approvals": GatePass.objects.filter(college_id=tenant_id, status='pending').count(),
                    "overdue_complaints": Complaint.objects.filter(college_id=tenant_id, is_overdue=True).count()
                },
                "last_updated": now.isoformat()
            }

            DashboardSummary.objects.update_or_create(
                tenant_id=tenant_id,
                viewer_role='principal',
                defaults={
                    'summary_data': summary_data,
                    'expires_at': expiry
                }
            )

        return {"status": "success", "hydrated": "all"}
    except Exception as exc:
        self.retry_with_context(exc, context='refresh_read_models')
