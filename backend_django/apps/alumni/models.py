"""Alumni app models — Phase 8."""

from django.db import models
from core.models import TenantModel
from apps.auth.models import User

class AlumniProfile(TenantModel):
    """Network presence for former students."""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='alumni_profile')
    graduation_year = models.PositiveIntegerField()
    department = models.CharField(max_length=100)
    
    current_company = models.CharField(max_length=200, blank=True)
    job_role = models.CharField(max_length=150, blank=True)
    location = models.CharField(max_length=150, blank=True)
    
    linkedin = models.URLField(blank=True)
    achievements = models.TextField(blank=True)
    
    is_active = models.BooleanField(default=True)
    is_mentor = models.BooleanField(default=False)

    class Meta:
        db_table = 'alumni_profile'
        ordering = ['-graduation_year']
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'graduation_year']),
            models.Index(fields=['tenant_id', '-created_at'], name='alumni_tenant_created_idx'),
        ]

    def __str__(self):
        return f"Alumni: {self.user.username} ({self.graduation_year})"

class Mentorship(TenantModel):
    """Network connection between Alumni and Student."""
    
    STATUS_CHOICES = [
        ('requested', 'Requested'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
        ('closed', 'Closed'),
    ]
    
    mentor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='mentoring_relationships')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='mentor_relationships')
    
    topic = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='requested')
    
    mentor_notes = models.TextField(blank=True)
    student_notes = models.TextField(blank=True)

    class Meta:
        db_table = 'alumni_mentorship'
        unique_together = ['mentor', 'student']
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'status'], name='mentor_tenant_status_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='mentor_tenant_created_idx'),
        ]

    def __str__(self):
        return f"{self.mentor.username} -> {self.student.username} ({self.status})"
