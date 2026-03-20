"""Events app models."""

from django.db import models
from django.db.models import Count, Q
from core.models import TimestampedModel, TargetedCommunicationModel
from core.constants import AudienceTargets
from apps.auth.models import User
import uuid


class Event(TimestampedModel, TargetedCommunicationModel):
    """Model for hostel events."""

    EVENT_AUDIENCE_CHOICES = AudienceTargets.CHOICES + [
        (AudienceTargets.STAFF_ONLY, 'Staff Only'),
        (AudienceTargets.SPECIFIC_DEPARTMENT, 'Specific Department'),
        (AudienceTargets.SPECIFIC_YEAR, 'Specific Year'),
        ('all', 'Everyone'),
    ]
    
    EVENT_TYPES = [
        ('sports', 'Sports'),
        ('cultural', 'Cultural'),
        ('educational', 'Educational'),
        ('social', 'Social'),
        ('maintenance', 'Maintenance'),
    ]
    
    college = models.ForeignKey(
        'colleges.College', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='events', db_index=True,
    )
    title = models.CharField(max_length=200)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPES)
    description = models.TextField()
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    location = models.CharField(max_length=200)
    organizer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='organized_events')
    max_participants = models.IntegerField(null=True, blank=True, verbose_name="Max Players")
    min_players = models.IntegerField(default=1, verbose_name="Min Players")
    
    # Sports Specific — court references the canonical SportCourt in apps.sports
    court = models.ForeignKey('sports.SportCourt', on_delete=models.SET_NULL, null=True, blank=True, related_name='event_slots')
    is_match_ready = models.BooleanField(default=False)
    
    is_mandatory = models.BooleanField(default=False)
    external_link = models.URLField(max_length=500, null=True, blank=True, help_text="External link (e.g. Google Form)")
    image = models.ImageField(upload_to='events/', null=True, blank=True)
    gallery_images = models.JSONField(default=list, blank=True, help_text="Optional list of gallery image URLs")
    event_video = models.URLField(max_length=500, null=True, blank=True)
    sponsor_logos = models.JSONField(default=list, blank=True, help_text="Optional list of sponsor logo URLs")
    highlight_as_banner = models.BooleanField(default=False)

    # Per-event controls
    allow_registration = models.BooleanField(default=True)
    enable_attendance = models.BooleanField(default=True)
    enable_certificates = models.BooleanField(default=False)
    enable_points = models.BooleanField(default=False)
    enable_waitlist = models.BooleanField(default=True)
    enable_reminders = models.BooleanField(default=True)
    points_value = models.PositiveIntegerField(default=0)
    enable_tickets = models.BooleanField(default=False)
    ticket_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Additional audience metadata for advanced targeting
    target_audience = models.CharField(
        max_length=50,
        choices=EVENT_AUDIENCE_CHOICES,
        default=AudienceTargets.ALL_STUDENTS,
    )
    target_department = models.CharField(max_length=100, blank=True, default='')
    target_year = models.PositiveSmallIntegerField(null=True, blank=True)
    
    # Academic Calendar Flags
    is_holiday = models.BooleanField(default=False, help_text="Is this a college holiday?")
    is_exam = models.BooleanField(default=False, help_text="Is this an exam period?")
    
    class Meta:
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['event_type', '-start_date'], name='events_even_event_t_8f992c_idx'),
            models.Index(fields=['college', '-start_date'], name='events_college_start_idx'),
            models.Index(fields=['is_holiday', 'start_date'], name='events_holiday_start_idx'),
        ]
        db_table = 'events_event'
    
    def __str__(self):
        return self.title


class EventRegistration(TimestampedModel):
    """Model for event registrations."""
    
    STATUS_CHOICES = [
        ('registered', 'Registered'),
        ('waitlisted', 'Waitlisted'),
        ('attended', 'Attended'),
        ('absent', 'Absent'),
        ('cancelled', 'Cancelled'),
    ]
    
    college = models.ForeignKey(
        'colleges.College', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='event_registrations', db_index=True,
    )
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='registrations')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_registrations')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='registered', db_index=True)
    
    # QR token — canonical format: EV:<uuid4>
    qr_code_reference = models.CharField(max_length=100, unique=True, null=True, blank=True)
    match_group_id = models.CharField(max_length=100, null=True, blank=True)
    check_in_time = models.DateTimeField(null=True, blank=True)
    scan_method = models.CharField(
        max_length=10,
        choices=[('qr', 'QR Code'), ('manual', 'Manual Entry')],
        null=True, blank=True,
    )

    class Meta:
        unique_together = ['event', 'student']
        db_table = 'events_registration'
    
    def save(self, *args, **kwargs):
        if not self.qr_code_reference:
            import uuid
            # Canonical format: EV:<uuid4> — matches unified scan endpoint token format
            self.qr_code_reference = f"EV:{uuid.uuid4()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.student} - {self.event.title}"

    @property
    def qr_data(self):
        """Generate QR data string for booking verification."""
        if not self.qr_code_reference:
            return None
        return {
            "booking_id": self.id,
            "student_id": self.student_id,
            "court_id": self.event.court_id,
            "date": self.event.start_date.date().isoformat(),
            "time_slot": f"{self.event.start_date.strftime('%H:%M')} - {self.event.end_date.strftime('%H:%M')}"
        }


class EventActivityPoint(TimestampedModel):
    """Tracks points awarded for event participation."""

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='activity_points')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_activity_points')
    registration = models.ForeignKey(EventRegistration, on_delete=models.SET_NULL, null=True, blank=True, related_name='awarded_points')
    points = models.IntegerField(default=0)
    reason = models.CharField(max_length=120, default='participation')
    awarded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='awarded_event_points')

    class Meta:
        unique_together = ['event', 'student', 'reason']
        ordering = ['-created_at']
        db_table = 'events_activity_points'

    def __str__(self):
        return f"{self.student} +{self.points} ({self.event.title})"


class EventFeedback(TimestampedModel):
    """Post-event feedback submitted by students."""

    RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='feedback_entries')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_feedback_entries')
    registration = models.ForeignKey(EventRegistration, on_delete=models.SET_NULL, null=True, blank=True, related_name='feedback_entries')
    rating = models.IntegerField(choices=RATING_CHOICES)
    comment = models.TextField(blank=True, default='')

    class Meta:
        unique_together = ['event', 'student']
        ordering = ['-created_at']
        db_table = 'events_feedback'

    def __str__(self):
        return f"{self.event.title} feedback by {self.student} ({self.rating}⭐)"


class EventTicket(TimestampedModel):
    """Ticket records for premium events with payment state and QR validation token."""

    PAYMENT_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed'),
        ('refunded', 'Refunded'),
    ]

    TICKET_STATUS_CHOICES = [
        ('active', 'Active'),
        ('cancelled', 'Cancelled'),
        ('used', 'Used'),
    ]

    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='tickets')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='event_tickets')
    registration = models.ForeignKey(EventRegistration, on_delete=models.SET_NULL, null=True, blank=True, related_name='tickets')
    college = models.ForeignKey(
        'colleges.College', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='event_tickets', db_index=True,
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    currency = models.CharField(max_length=10, default='INR')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending', db_index=True)
    ticket_status = models.CharField(max_length=20, choices=TICKET_STATUS_CHOICES, default='active', db_index=True)
    payment_reference = models.CharField(max_length=120, blank=True, default='')
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        db_table = 'events_tickets'
        indexes = [
            models.Index(fields=['event', 'student']),
            models.Index(fields=['payment_status', 'ticket_status']),
        ]

    def __str__(self):
        return f"Ticket #{self.id} {self.event.title} - {self.student}"
