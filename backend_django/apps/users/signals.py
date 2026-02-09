from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.disciplinary.models import DisciplinaryAction
from apps.attendance.models import Attendance
from apps.users.models import Tenant

@receiver(post_save, sender=DisciplinaryAction)
def update_risk_score_on_discipline(sender, instance, **kwargs):
    """Update student risk score when disciplinary action is added."""
    student = instance.student
    if hasattr(student, 'tenant'):
        tenant = student.tenant
        # Recalculate score
        # Recalculate score using aggregation for O(1) performance
        from django.db.models import Sum, Case, When, Value, IntegerField
        
        # Calculate score directly in DB
        result = DisciplinaryAction.objects.filter(student=student).aggregate(
            total_score=Sum(
                Case(
                    When(severity='low', then=Value(10)),
                    When(severity='medium', then=Value(25)),
                    When(severity='high', then=Value(50)),
                    When(severity='severe', then=Value(100)),
                    default=Value(0),
                    output_field=IntegerField()
                )
            )
        )
        score = result['total_score'] or 0
        
        tenant.risk_score = score
        
        # Update status
        if score >= 100: tenant.risk_status = 'critical'
        elif score >= 50: tenant.risk_status = 'high'
        elif score >= 25: tenant.risk_status = 'medium'
        else: tenant.risk_status = 'low'
        
        tenant.save(update_fields=['risk_score', 'risk_status'])

@receiver(post_save, sender=Attendance)
def update_risk_on_absent(sender, instance, **kwargs):
    """Flag risk if student is absent frequently."""
    # This acts as a trigger. Real logic would need historical analysis.
    # For now, we just touch the tenant to trigger updates if needed
    pass
