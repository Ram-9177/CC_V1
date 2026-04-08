"""User models."""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import TimestampedModel
from apps.auth.models import User

class Tenant(TimestampedModel):
    """Tenant/Student model with additional details."""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='tenant')
    father_name = models.CharField(max_length=100, blank=True)
    father_phone = models.CharField(max_length=15, blank=True)
    mother_name = models.CharField(max_length=100, blank=True)
    mother_phone = models.CharField(max_length=15, blank=True)
    guardian_name = models.CharField(max_length=100, blank=True)
    guardian_phone = models.CharField(max_length=15, blank=True)
    emergency_contact = models.CharField(max_length=100, blank=True)
    id_proof = models.ImageField(upload_to='id_proofs/', null=True, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=50, blank=True)
    state = models.CharField(max_length=50, blank=True)
    pincode = models.CharField(max_length=10, blank=True)
    college_code = models.CharField(max_length=20, blank=True, null=True)
    parent_informed = models.BooleanField(default=False)
    
    # Career & Placement
    cgpa = models.DecimalField(max_digits=4, decimal_places=2, default=0.0, validators=[MinValueValidator(0), MaxValueValidator(10)])
    department = models.CharField(max_length=100, blank=True, help_text="e.g. CS, IT, MECH")
    
    # Risk & Discipline Flags
    RISK_STATUS_CHOICES = [
        ('low', 'Low Risk'),
        ('medium', 'Medium Risk'),
        ('high', 'High Risk'),
        ('critical', 'Critical Risk'),
    ]
    risk_score = models.IntegerField(default=0, help_text="Auto-calculated risk score based on disciplinary actions")
    risk_status = models.CharField(max_length=20, choices=RISK_STATUS_CHOICES, default='low')
    disciplinary_notes = models.TextField(blank=True, help_text="Internal notes by Warden")
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['college_code']),
            models.Index(fields=['risk_status']),
        ]

    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.user.registration_number}"


class HRPermission(TimestampedModel):
    """Admin-controlled dynamic permissions for HR (Student)."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='hr_permissions')
    
    can_view_attendance = models.BooleanField(default=False, help_text="Can view hostel attendance")
    can_raise_complaints = models.BooleanField(default=True, help_text="Can raise complaints")
    can_view_complaints = models.BooleanField(default=False, help_text="Can view complaints for assigned hostel")
    can_assist_reports = models.BooleanField(default=False, help_text="Can view/assist in report generation")
    can_manage_notices = models.BooleanField(default=False, help_text="Can manage notices (create/edit/delete)")

    def __str__(self):
        return f"HR Permissions: {self.user.get_full_name()} ({self.user.registration_number})"

    class Meta:
        verbose_name = "HR Permission"
        verbose_name_plural = "HR Permissions"


class StudentTypeAuditLog(TimestampedModel):
    """Immutable record of every student_type change."""
    from django.conf import settings

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="type_change_logs",
    )
    old_type = models.CharField(max_length=20)
    new_type = models.CharField(max_length=20)
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="type_changes_performed",
    )
    change_request_id = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "student_type_audit_log"
        indexes = [
            models.Index(fields=["student", "-created_at"]),
            models.Index(fields=["new_type", "-created_at"]),
        ]

    def __str__(self):
        return (
            f"{self.student} | {self.old_type} → {self.new_type} "
            f"| by {self.performed_by} | {self.created_at}"
        )


class StudentTypeChangeRequest(TimestampedModel):
    """
    Workflow model: Warden initiates → Head Warden / Admin approves.
    Applied atomically by StudentTypeChangeService.execute().
    """
    from django.conf import settings

    STATUS_CHOICES = [
        ("pending", "Pending Approval"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("executed", "Executed"),
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="type_change_requests",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="type_change_requests_initiated",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="type_change_requests_approved",
    )

    current_type = models.CharField(max_length=20)
    new_type = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    reason = models.TextField(help_text="Why this change is being requested.")
    rejection_reason = models.TextField(blank=True)

    # For day_scholar → hosteller: must specify a room (and optionally a bed)
    target_room_id = models.IntegerField(
        null=True, blank=True,
        help_text="Required when converting day_scholar → hosteller"
    )
    target_bed_id = models.IntegerField(
        null=True, blank=True,
        help_text="Optional specific bed (auto-assigned if omitted)"
    )

    approved_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "student_type_change_request"
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return (
            f"TypeChange #{self.id}: {self.student} "
            f"{self.current_type}→{self.new_type} [{self.status}]"
        )
