"""Models for campus hall management and booking."""

from django.core.exceptions import ValidationError
from django.db import models

from apps.auth.models import User
from core.models import TimestampedModel


class Hall(TimestampedModel):
    """Manage campus halls that can be booked."""

    hall_id = models.CharField(max_length=50, unique=True)
    hall_name = models.CharField(max_length=150)
    capacity = models.PositiveIntegerField()
    location = models.CharField(max_length=200)
    facilities = models.TextField(blank=True)
    manager = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_halls',
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'hall_booking_hall'
        ordering = ['hall_name']
        indexes = [
            models.Index(fields=['hall_id']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.hall_name} ({self.hall_id})"


class HallBooking(TimestampedModel):
    """Booking request for a hall with approval workflow."""

    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
    ]

    hall = models.ForeignKey(Hall, on_delete=models.CASCADE, related_name='bookings')
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hall_bookings')
    booking_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    event_name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hall_bookings_reviewed',
    )
    review_note = models.CharField(max_length=300, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'hall_booking_booking'
        ordering = ['booking_date', 'start_time']
        indexes = [
            models.Index(fields=['hall', 'booking_date']),
            models.Index(fields=['booking_date', 'status']),
            models.Index(fields=['status', 'booking_date']),
        ]

    def __str__(self):
        return f"{self.event_name} - {self.hall.hall_name} ({self.booking_date})"

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError({'end_time': 'End time must be after start time.'})

        blocked_statuses = [self.STATUS_PENDING, self.STATUS_APPROVED]
        conflicts = HallBooking.objects.filter(
            hall_id=self.hall_id,
            booking_date=self.booking_date,
            status__in=blocked_statuses,
            start_time__lt=self.end_time,
            end_time__gt=self.start_time,
        )
        if self.pk:
            conflicts = conflicts.exclude(pk=self.pk)

        if conflicts.exists():
            raise ValidationError('This hall is already booked for the selected date and time range.')
