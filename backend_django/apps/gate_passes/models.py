"""Gate Passes app models."""

from django.db import models
from core.models import TenantModel, TimestampedModel
from apps.auth.models import User
from datetime import datetime
from django.conf import settings

def get_audio_storage():
    """Return appropriate storage for audio files (callable for Django migrations)."""
    if getattr(settings, 'CLOUDINARY_URL', ''):
        from cloudinary_storage.storage import VideoMediaCloudinaryStorage
        return VideoMediaCloudinaryStorage()
    from django.core.files.storage import FileSystemStorage
    return FileSystemStorage(location=settings.MEDIA_ROOT)


class GatePass(TenantModel):
    """Authority model for student gate passes with institutional lifecycle tracking."""
    
    STATUS_CHOICES = [
        ('draft', 'Draft (Saved)'),
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('out', 'Currently Outside'),
        ('in', 'Returned'),
        ('completed', 'Completed'),
        ('expired', 'Expired'),
    ]
    
    PASS_TYPE_CHOICES = [
        ('day', 'Day Pass'),
        ('overnight', 'Overnight'),
        ('weekend', 'Weekend'),
        ('emergency', 'Emergency'),
        ('leave', 'Leave'),
    ]

    MOVEMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('inside', 'Inside'),
        ('outside', 'Outside'),
        ('returned', 'Returned'),
    ]
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gate_passes')
    pass_type = models.CharField(max_length=20, choices=PASS_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    exit_date = models.DateTimeField(help_text="Scheduled/Planned exit time")
    entry_date = models.DateTimeField(null=True, blank=True, help_text="Scheduled/Planned return time")
    
    # Movement Tracking
    exit_time = models.DateTimeField(null=True, blank=True, help_text="Actual time when student left")
    entry_time = models.DateTimeField(null=True, blank=True, help_text="Actual time when student returned")
    exit_security = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, 
                                      related_name='marked_exits', help_text="Security staff who marked exit")
    entry_security = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, 
                                       related_name='marked_entries', help_text="Security staff who marked entry")
                                       
    reject_reason = models.TextField(blank=True, null=True, help_text="Reason for rejection by Warden or Security")
    
    # Audit fields: Preserve the actual times
    actual_exit_at = models.DateTimeField(null=True, blank=True)
    actual_entry_at = models.DateTimeField(null=True, blank=True)
    
    # Late Tracking (Phase 3)
    late_minutes = models.PositiveIntegerField(default=0)
    late_count = models.PositiveIntegerField(default=0, help_text="Total late occurrences for student at time of this pass")
    
    # Cache student type for faster filtering
    student_type = models.CharField(max_length=20, blank=True, null=True)
    
    reason = models.TextField()
    destination = models.CharField(max_length=200)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, 
                                   blank=True, related_name='approved_gate_passes')
    approved_at = models.DateTimeField(null=True, blank=True)
    approval_remarks = models.TextField(blank=True)
    movement_status = models.CharField(
        max_length=20,
        choices=MOVEMENT_STATUS_CHOICES,
        default='pending',
        db_index=True,
    )
    
    # Informed parents workflow
    parent_informed = models.BooleanField(default=False)
    parent_informed_at = models.DateTimeField(null=True, blank=True)

    # Pending approval timeout workflow
    pending_reminded_at = models.DateTimeField(null=True, blank=True)

    # Optional traceability link to an approved leave request
    leave_application = models.ForeignKey(
        'leaves.LeaveApplication',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='gate_passes',
    )
    
    qr_code = models.CharField(max_length=500, blank=True, null=True, unique=True)
    audio_brief = models.FileField(upload_to='gate_passes/audio/', storage=get_audio_storage, null=True, blank=True, help_text="Audio recording for reason (max 40s)")
    
    class Meta:
        ordering = ['-exit_date']
        indexes = [
            # Core student lookup (used on every dashboard load)
            models.Index(fields=['student', '-exit_date'], name='gp_student_exit_idx'),
            # Status+date composite: powers forecast & security scan queries
            models.Index(fields=['status', 'exit_date'], name='gp_status_exit_idx'),
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'status'], name='gp_tenant_status_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='gp_tenant_created_idx'),
            # Student + status: O(1) check for active pass per student
            models.Index(fields=['student', 'status'], name='gp_student_status_idx'),
            # Export queries ordered by created_at
            models.Index(fields=['-created_at'], name='gp_created_at_idx'),
            # Meal forecasting: status + exit + entry
            models.Index(fields=['status', 'exit_date', 'entry_date'], name='gp_forecast_idx'),
            # Partial index – PENDING passes only (small slice, fast approval queue)
            models.Index(
                fields=['student', 'created_at'],
                name='gp_pending_student_idx',
                condition=models.Q(status='pending'),
            ),
            # Partial index – APPROVED passes only (security scan hotpath)
            models.Index(
                fields=['student', 'exit_date'],
                name='gp_approved_student_idx',
                condition=models.Q(status='approved'),
            ),
        ]
        db_table = 'gate_passes_gatepass'
    
    def save(self, *args, **kwargs):
        if not self.qr_code:
            import uuid
            # Canonical format: GP:<uuid4> — matches unified scan endpoint token format
            self.qr_code = f"GP:{uuid.uuid4()}"
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # Ensure audio files are wiped if the underlying object gets entirely deleted (e.g. cascading deletes or manual deletion)
        if self.audio_brief:
            try:
                self.audio_brief.delete(save=False)
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning(f"Failed to delete audio_brief on GatePass model deletion: {e}")
        super().delete(*args, **kwargs)
    
    def __str__(self):
        return f"{self.student} - {self.pass_type} - {self.status}"


class GateScan(TenantModel):
    """Log of gate scans with institutional context."""
    
    DIRECTION_CHOICES = [
        ('in', 'Entry'),
        ('out', 'Exit'),
    ]
    
    gate_pass = models.ForeignKey(GatePass, on_delete=models.CASCADE,
                                  related_name='scans', null=True, blank=True)
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gate_scans')
    SCAN_METHOD_CHOICES = [('qr', 'QR Code'), ('manual', 'Manual Entry')]

    direction = models.CharField(max_length=10, choices=DIRECTION_CHOICES)
    scan_time = models.DateTimeField(auto_now_add=True)
    qr_code = models.CharField(max_length=500)
    location = models.CharField(max_length=100, blank=True)
    scan_method = models.CharField(
        max_length=10, choices=SCAN_METHOD_CHOICES, default='qr'
    )
    
    class Meta:
        ordering = ['-scan_time']
        indexes = [
            models.Index(fields=['student', '-scan_time'], name='scan_student_time_idx'),
            models.Index(fields=['gate_pass', '-scan_time'], name='scan_gatepass_idx'),
            models.Index(fields=['-scan_time'], name='scan_global_time_idx'),
        ]
        db_table = 'gate_passes_gatescan'
    
    def __str__(self):
        return f"{self.student} - {self.direction} - {self.scan_time}"
