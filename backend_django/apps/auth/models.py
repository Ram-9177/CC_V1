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
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.registration_number})"
