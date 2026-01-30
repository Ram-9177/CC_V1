"""User models."""
from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User

class Tenant(TimestampedModel):
    """Tenant/Student model with additional details."""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='tenant')
    guardian_name = models.CharField(max_length=100, blank=True)
    guardian_phone = models.CharField(max_length=15, blank=True)
    emergency_contact = models.CharField(max_length=100, blank=True)
    id_proof = models.ImageField(upload_to='id_proofs/', null=True, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=50, blank=True)
    state = models.CharField(max_length=50, blank=True)
    pincode = models.CharField(max_length=10, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user.get_full_name()} - {self.user.registration_number}"
