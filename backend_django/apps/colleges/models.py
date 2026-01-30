"""Colleges app models."""

from django.db import models
from core.models import TimestampedModel


class College(TimestampedModel):
    """Model for colleges/universities."""
    
    name = models.CharField(max_length=200, unique=True)
    code = models.CharField(max_length=50, unique=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)
    
    class Meta:
        ordering = ['name']
        db_table = 'colleges_college'
    
    def __str__(self):
        return self.name
