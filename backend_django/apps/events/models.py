"""Events app models."""

from django.db import models
from django.db.models import Count, Q
from core.models import TimestampedModel, TargetedCommunicationModel
from apps.auth.models import User
import uuid


class SportsCourt(TimestampedModel):
    """Model for sports courts and venues."""
    name = models.CharField(max_length=100)
    sport_name = models.CharField(max_length=100, help_text="e.g. Badminton, Basketball")
    location_details = models.CharField(max_length=200, blank=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.name} ({self.sport_name})"


class SportsBookingConfig(TimestampedModel):
    """Configuration for sports booking limits."""
    max_bookings_per_day = models.IntegerField(default=1)
    max_bookings_per_week = models.IntegerField(default=3)
    
    class Meta:
        verbose_name = "Sports Booking Configuration"
        verbose_name_plural = "Sports Booking Configuration"

    def __str__(self):
        return f"Booking Limits: {self.max_bookings_per_day}/day, {self.max_bookings_per_week}/week"


class Event(TimestampedModel, TargetedCommunicationModel):
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
    max_participants = models.IntegerField(null=True, blank=True, verbose_name="Max Players")
    min_players = models.IntegerField(default=1, verbose_name="Min Players")
    
    # Sports Specific
    court = models.ForeignKey(SportsCourt, on_delete=models.SET_NULL, null=True, blank=True, related_name='slots')
    is_match_ready = models.BooleanField(default=False)
    
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
    
    # Sports Specific
    qr_code_reference = models.CharField(max_length=100, unique=True, null=True, blank=True)
    match_group_id = models.CharField(max_length=100, null=True, blank=True)
    check_in_time = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ['event', 'student']
        db_table = 'events_registration'
    
    def __str__(self):
        return f"{self.student} - {self.event.title}"
