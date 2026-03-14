"""
Sports module models.

Hierarchy:  Sport  →  SportCourt  →  CourtSlot  →  SportBooking  →  SportAttendance

Additional:  SportsPolicy (singleton, PD configures)
             DepartmentSportsRequest (HOD requests class matches, PD approves)
"""

import uuid
from django.conf import settings
from django.db import models
from core.models import TimestampedModel


class Sport(TimestampedModel):
    GAME_TYPES = [
        ('singles', 'Singles'),
        ('doubles', 'Doubles'),
        ('team', 'Team'),
        ('mixed', 'Mixed'),
    ]
    STATUS_CHOICES = [('active', 'Active'), ('inactive', 'Inactive')]

    name = models.CharField(max_length=100, unique=True)
    min_players = models.PositiveIntegerField(default=1)
    max_players = models.PositiveIntegerField(default=10)
    game_type = models.CharField(max_length=20, choices=GAME_TYPES, default='team')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    icon = models.CharField(max_length=50, blank=True, help_text='Emoji or icon name, e.g. 🏸')
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'sports_sport'
        ordering = ['name']

    def __str__(self):
        return self.name


class SportCourt(TimestampedModel):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('maintenance', 'Under Maintenance'),
        ('closed', 'Closed'),
    ]

    name = models.CharField(max_length=100)
    sport = models.ForeignKey(Sport, on_delete=models.CASCADE, related_name='courts')
    location = models.CharField(max_length=200, blank=True)
    capacity = models.PositiveIntegerField(default=10)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'sports_court'
        ordering = ['sport__name', 'name']

    def __str__(self):
        return f"{self.name} ({self.sport.name})"


class CourtSlot(TimestampedModel):
    court = models.ForeignKey(SportCourt, on_delete=models.CASCADE, related_name='slots')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    max_players = models.PositiveIntegerField()
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'sports_courtslot'
        ordering = ['date', 'start_time']
        unique_together = ['court', 'date', 'start_time']

    def __str__(self):
        return f"{self.court.name} – {self.date} {self.start_time}–{self.end_time}"

    @property
    def current_bookings(self):
        return self.bookings.filter(status__in=['confirmed', 'attended']).count()

    @property
    def vacancy(self):
        return max(0, self.max_players - self.current_bookings)

    @property
    def is_full(self):
        return self.vacancy == 0

    @property
    def is_match_ready(self):
        return self.current_bookings >= self.court.sport.min_players


class SportsPolicy(TimestampedModel):
    """
    Singleton-ish model.  PD creates at most one record.
    All booking enforcement references the first row.
    """
    max_bookings_per_day = models.PositiveIntegerField(default=1)
    max_bookings_per_week = models.PositiveIntegerField(default=3)
    allow_same_sport_same_day = models.BooleanField(default=False)
    booking_window_days = models.PositiveIntegerField(
        default=7,
        help_text='How many days ahead students may book slots.',
    )

    class Meta:
        db_table = 'sports_policy'
        verbose_name_plural = 'Sports Policies'

    def __str__(self):
        return f"Policy: max {self.max_bookings_per_day}/day, {self.max_bookings_per_week}/week"


class SportBooking(TimestampedModel):
    STATUS_CHOICES = [
        ('confirmed', 'Confirmed'),
        ('cancelled', 'Cancelled'),
        ('attended', 'Attended'),
        ('no_show', 'No Show'),
    ]

    slot = models.ForeignKey(CourtSlot, on_delete=models.CASCADE, related_name='bookings')
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sport_bookings',
    )
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='confirmed', db_index=True
    )
    SCAN_METHOD_CHOICES = [('qr', 'QR Code'), ('manual', 'Manual Entry')]

    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    check_in_time = models.DateTimeField(null=True, blank=True)
    scan_method = models.CharField(
        max_length=10, choices=SCAN_METHOD_CHOICES, default='qr'
    )
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='sport_checkins',
    )

    class Meta:
        db_table = 'sports_booking'
        ordering = ['-created_at']
        unique_together = ['slot', 'student']

    def __str__(self):
        return f"{self.student} → {self.slot}"

    @property
    def qr_data(self):
        return {
            'qr_token': str(self.qr_token),
            'booking_id': self.id,
            'slot_id': self.slot_id,
            'sport': self.slot.court.sport.name,
            'court': self.slot.court.name,
            'date': str(self.slot.date),
            'time': f"{self.slot.start_time}–{self.slot.end_time}",
        }


class SportAttendance(TimestampedModel):
    booking = models.OneToOneField(
        SportBooking, on_delete=models.CASCADE, related_name='attendance'
    )
    scanned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='sports_scans',
    )
    notes = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = 'sports_attendance'
        ordering = ['-created_at']

    def __str__(self):
        return f"Scan: {self.booking}"


class DepartmentSportsRequest(TimestampedModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    ]

    title = models.CharField(max_length=200)
    requesting_hod = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='class_sports_requests',
    )
    sport = models.ForeignKey(Sport, on_delete=models.CASCADE, related_name='dept_requests')
    preferred_court = models.ForeignKey(
        SportCourt,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='dept_requests',
    )
    requested_date = models.DateField()
    requested_start_time = models.TimeField()
    requested_end_time = models.TimeField()
    department = models.CharField(max_length=100)
    year_of_study = models.PositiveIntegerField(null=True, blank=True)
    estimated_players = models.PositiveIntegerField()
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reviewed_sports_requests',
    )
    allocated_slot = models.ForeignKey(
        CourtSlot,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='dept_request',
    )
    rejection_reason = models.CharField(max_length=300, blank=True)

    class Meta:
        db_table = 'sports_dept_request'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.title} ({self.status})"
