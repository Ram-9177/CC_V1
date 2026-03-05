"""User models."""
from django.db import models
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
