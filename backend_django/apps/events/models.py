"""Events app models — Phase 6."""

from django.db import models
from core.models import TenantModel
from apps.auth.models import User

class Event(TenantModel):
    """Event resource + participation system."""
    
    EVENT_TYPES = [
        ('cultural', 'Cultural'),
        ('academic', 'Academic'),
        ('sports', 'Sports'),
    ]
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('completed', 'Completed'),
    ]
    
    title = models.CharField(max_length=200)
    description = models.TextField()
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    
    location = models.CharField(max_length=200)
    # can be linked to SportFacility if event_type is sports
    facility = models.ForeignKey(
        'sports.SportFacility', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='events'
    )
    
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_events')
    is_holiday = models.BooleanField(default=False)
    
    is_paid = models.BooleanField(default=False)
    fee_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    external_link = models.CharField(max_length=500, null=True, blank=True)
    
    capacity = models.PositiveIntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    class Meta:
        db_table = 'events_event_v2'
        ordering = ['-start_time']
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'status'], name='event_tenant_status_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='event_tenant_created_idx'),
        ]

    def __str__(self):
        return self.title

class EventRegistration(TenantModel):
    """Event participation tracking."""
    
    STATUS_CHOICES = [
        ('registered', 'Registered'),
        ('attended', 'Attended'),
        ('cancelled', 'Cancelled'),
    ]
    
    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('waived', 'Waived'),
    ]
    
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='registrations_v2')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_registrations_v2')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='registered')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    
    attended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'events_registration_v2'
        unique_together = ['event', 'student']
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'status'], name='evreg_tenant_status_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='evreg_tenant_created_idx'),
        ]

    def __str__(self):
        return f"{self.student.username} - {self.event.title}"
