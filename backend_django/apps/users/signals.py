from django.db.models.signals import post_save
from django.dispatch import receiver
from django.db.models import Sum, Case, When, Value, IntegerField
from datetime import timedelta
from django.utils import timezone
from apps.disciplinary.models import DisciplinaryAction
from apps.attendance.models import Attendance


def _recalculate_tenant_risk(student):
    """Recompute student risk score from discipline + recent attendance."""
    tenant = getattr(student, 'tenant', None)
    if not tenant:
        return

    disciplinary_result = DisciplinaryAction.objects.filter(student=student).aggregate(
        total_score=Sum(
            Case(
                When(severity='low', then=Value(10)),
                When(severity='medium', then=Value(25)),
                When(severity='high', then=Value(50)),
                When(severity='severe', then=Value(100)),
                default=Value(0),
                output_field=IntegerField(),
            )
        )
    )
    disciplinary_score = disciplinary_result['total_score'] or 0

    window_start = timezone.now().date() - timedelta(days=30)
    recent_absences = Attendance.objects.filter(
        user=student,
        status='absent',
        attendance_date__gte=window_start,
    ).count()
    # Cap attendance contribution to avoid runaway scores from historical data spikes.
    attendance_score = min(recent_absences * 5, 50)

    total_score = disciplinary_score + attendance_score
    tenant.risk_score = total_score

    if total_score >= 100:
        tenant.risk_status = 'critical'
    elif total_score >= 50:
        tenant.risk_status = 'high'
    elif total_score >= 25:
        tenant.risk_status = 'medium'
    else:
        tenant.risk_status = 'low'

    tenant.save(update_fields=['risk_score', 'risk_status'])

@receiver(post_save, sender=DisciplinaryAction)
def update_risk_score_on_discipline(sender, instance, **kwargs):
    """Update student risk score when disciplinary action is added."""
    _recalculate_tenant_risk(instance.student)

@receiver(post_save, sender=Attendance)
def update_risk_on_absent(sender, instance, **kwargs):
    """Flag risk if student is absent frequently."""
    _recalculate_tenant_risk(instance.user)
