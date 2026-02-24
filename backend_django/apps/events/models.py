"""Events app models."""

from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User


class Event(TimestampedModel):
    """Model for hostel events."""
    
    EVENT_TYPES = [
        ('sports', 'Sports'),
        ('cultural', 'Cultural'),
        ('educational', 'Educational'),
        ('social', 'Social'),
        ('maintenance', 'Maintenance'),
    ]
    
    title = models.CharField(max_length=200)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    description = models.TextField()
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    location = models.CharField(max_length=200)
    organizer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='organized_events')
    max_participants = models.IntegerField(null=True, blank=True)
    is_mandatory = models.BooleanField(default=False)
    external_link = models.URLField(max_length=500, null=True, blank=True, help_text="External link (e.g. Google Form)")
    image = models.ImageField(upload_to='events/', null=True, blank=True)
    
    # Academic Calendar Flags
    is_holiday = models.BooleanField(default=False, help_text="Is this a college holiday?")
    is_exam = models.BooleanField(default=False, help_text="Is this an exam period?")
    
    class Meta:
        ordering = ['-start_date']
        indexes = [models.Index(fields=['event_type', '-start_date'], name='events_even_event_t_8f992c_idx')]
        db_table = 'events_event'
    
    def __str__(self):
        return self.title


class EventRegistration(TimestampedModel):
    """Model for event registrations."""
    
    STATUS_CHOICES = [
        ('registered', 'Registered'),
        ('attended', 'Attended'),
        ('absent', 'Absent'),
        ('cancelled', 'Cancelled'),
    ]
    
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='registrations')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_registrations')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='registered', db_index=True)
    
    class Meta:
        unique_together = ['event', 'student']
        db_table = 'events_registration'
    
    def __str__(self):
        return f"{self.student} - {self.event.title}"
