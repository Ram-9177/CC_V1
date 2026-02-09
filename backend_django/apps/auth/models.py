"""Custom User model for authentication."""

from django.contrib.auth.models import AbstractUser
from django.db import models
from core.models import TimestampedModel


class User(AbstractUser, TimestampedModel):
    """Extended User model with custom fields."""
    
    ROLE_CHOICES = [
        ('student', 'Student'),
        ('staff', 'Staff'),
        ('admin', 'Admin'),
        ('super_admin', 'Super Admin'),
        ('head_warden', 'Head Warden'),
        ('warden', 'Warden'),
        ('chef', 'Chef'),
        ('gate_security', 'Gate Security'),
        ('security_head', 'Security Head'),
    ]
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    phone_number = models.CharField(max_length=15, blank=True)
    registration_number = models.CharField(max_length=50, unique=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        db_table = 'hostelconnect_user'
        indexes = [
            models.Index(fields=['phone_number']),
            models.Index(fields=['role']),
        ]

    def save(self, *args, **kwargs):
        # Normalize hall tickets/usernames and registration numbers to uppercase.
        if self.username:
            self.username = self.username.strip().upper()

        reg_no = (self.registration_number or '').strip()
        if not reg_no:
            reg_no = self.username or ''
        self.registration_number = reg_no.upper() if reg_no else reg_no

        # Keep registration_number usable even for admin-created/superusers.
        if not self.registration_number and self.username:
            self.registration_number = self.username
        super().save(*args, **kwargs)
    
    def __str__(self):
        name = (self.get_full_name() or '').strip() or self.username
        reg = (self.registration_number or '').strip() or self.username
        return f"{name} ({reg})"
