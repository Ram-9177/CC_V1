"""Sports app models — Phase 6."""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.models import TenantModel
from apps.auth.models import User

class SportFacility(TenantModel):
    """Resource: Ground / Court / Gym."""
    
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    capacity = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'sports_facility_v2'
        verbose_name_plural = "Sport Facilities"

    def __str__(self):
        return self.name

class SportBooking(TenantModel):
    """Scheduling: Facility booking or slot assignment."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('cancelled', 'Cancelled'),
    ]
    
    facility = models.ForeignKey(SportFacility, on_delete=models.CASCADE, related_name='bookings')
    booked_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sport_bookings_v2')
    
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    class Meta:
        db_table = 'sports_booking_v2'
        ordering = ['-start_time']
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'status'], name='spbook_tenant_status_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='spbook_tenant_created_idx'),
        ]

    def __str__(self):
        return f"{self.booked_by.username} @ {self.facility.name}"

class SportsMatch(TenantModel):
    """Match records: Team contests."""
    
    MATCH_STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('ongoing', 'Ongoing'),
        ('completed', 'Completed'),
    ]
    
    title = models.CharField(max_length=150)
    teams = models.JSONField(default=dict, help_text="{'team_a': 'Name', 'team_b': 'Name'}")
    
    scheduled_time = models.DateTimeField()
    facility = models.ForeignKey(SportFacility, on_delete=models.CASCADE, related_name='matches')
    
    status = models.CharField(max_length=20, choices=MATCH_STATUS_CHOICES, default='scheduled')
    score = models.JSONField(default=dict, help_text="{'team_a': 0, 'team_b': 0}")
    winner = models.CharField(max_length=100, blank=True)
    
    organizer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='organized_matches_v2')

    class Meta:
        db_table = 'sports_match_v2'
        ordering = ['-scheduled_time']
        verbose_name_plural = "Sports Matches"
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'status'], name='spmatch_tenant_status_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='spmatch_tenant_created_idx'),
        ]

    def __str__(self):
        return f"{self.title} - {self.scheduled_time.strftime('%Y-%m-%d %H:%M')}"


# ---------------------------------------------------------------------------
# Frontend-compatible Sports domain (module-by-module bridge)
# ---------------------------------------------------------------------------


class Sport(models.Model):
    GAME_TYPE_CHOICES = [
        ('singles', 'Singles'),
        ('doubles', 'Doubles'),
        ('team', 'Team'),
        ('mixed', 'Mixed'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]

    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name='sports_catalog',
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=100)
    min_players = models.PositiveIntegerField(default=1)
    max_players = models.PositiveIntegerField(default=10)
    game_type = models.CharField(max_length=20, choices=GAME_TYPE_CHOICES, default='team')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    icon = models.CharField(max_length=32, blank=True, default='')
    description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sports_catalog'
        ordering = ['name']
        unique_together = [('college', 'name')]

    def __str__(self):
        return self.name


class SportCourt(models.Model):
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('maintenance', 'Maintenance'),
        ('closed', 'Closed'),
    ]

    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name='sports_courts',
        null=True,
        blank=True,
    )
    sport = models.ForeignKey(Sport, on_delete=models.CASCADE, related_name='courts')
    name = models.CharField(max_length=120)
    location = models.CharField(max_length=180, blank=True, default='')
    capacity = models.PositiveIntegerField(default=10)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sports_courts'
        ordering = ['name']

    def __str__(self):
        return self.name


class CourtSlot(models.Model):
    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name='sports_slots',
        null=True,
        blank=True,
    )
    court = models.ForeignKey(SportCourt, on_delete=models.CASCADE, related_name='slots')
    date = models.DateField(db_index=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    max_players = models.PositiveIntegerField(default=10)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'sports_court_slots'
        ordering = ['date', 'start_time']
        unique_together = [('court', 'date', 'start_time', 'end_time')]

    def __str__(self):
        return f"{self.court.name} {self.date} {self.start_time}-{self.end_time}"

    @property
    def current_bookings(self):
        return self.bookings.filter(status__in=['confirmed', 'attended']).count()

    @property
    def vacancy(self):
        value = self.max_players - self.current_bookings
        return max(value, 0)

    @property
    def is_full(self):
        return self.vacancy <= 0

    @property
    def is_match_ready(self):
        min_players = getattr(self.court.sport, 'min_players', 2)
        return self.current_bookings >= min_players

    @property
    def waitlist_count(self):
        return self.bookings.filter(status='waitlisted').count()


class SportsPolicy(models.Model):
    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name='sports_policies',
        null=True,
        blank=True,
    )
    max_bookings_per_day = models.PositiveIntegerField(default=1)
    max_bookings_per_week = models.PositiveIntegerField(default=3)
    allow_same_sport_same_day = models.BooleanField(default=False)
    booking_window_days = models.PositiveIntegerField(default=7)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sports_policy'
        ordering = ['-updated_at']


class SportSlotBooking(models.Model):
    STATUS_CHOICES = [
        ('confirmed', 'Confirmed'),
        ('waitlisted', 'Waitlisted'),
        ('cancelled', 'Cancelled'),
        ('attended', 'Attended'),
        ('no_show', 'No Show'),
    ]

    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name='sports_slot_bookings',
        null=True,
        blank=True,
    )
    slot = models.ForeignKey(CourtSlot, on_delete=models.CASCADE, related_name='bookings')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sports_slot_bookings')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed', db_index=True)
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    check_in_time = models.DateTimeField(null=True, blank=True)
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='sports_bookings_checked_in',
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'sports_slot_bookings'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', 'status']),
            models.Index(fields=['slot', 'status']),
        ]

    @property
    def qr_data(self):
        slot = self.slot
        court = slot.court
        sport = court.sport
        return {
            'qr_token': str(self.qr_token),
            'booking_id': self.id,
            'slot_id': slot.id,
            'sport': sport.name,
            'court': court.name,
            'date': str(slot.date),
            'time': f"{slot.start_time.strftime('%H:%M')}-{slot.end_time.strftime('%H:%M')}",
        }


class SportAttendance(models.Model):
    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name='sports_attendance_logs',
        null=True,
        blank=True,
    )
    booking = models.ForeignKey(SportSlotBooking, on_delete=models.CASCADE, related_name='attendance_logs')
    scanned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'sports_attendance'
        ordering = ['-created_at']


class SportEquipment(models.Model):
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('maintenance', 'Maintenance'),
        ('retired', 'Retired'),
    ]

    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name='sports_equipment',
        null=True,
        blank=True,
    )
    sport = models.ForeignKey(Sport, on_delete=models.CASCADE, related_name='equipment')
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=80, blank=True, default='')
    total_quantity = models.PositiveIntegerField(default=1)
    issued_quantity = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    storage_location = models.CharField(max_length=180, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sports_equipment'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.sport.name})"

    @property
    def available_quantity(self):
        return max(self.total_quantity - self.issued_quantity, 0)

    @property
    def is_low_stock(self):
        return self.available_quantity <= self.low_stock_threshold


class SportEquipmentIssue(models.Model):
    STATUS_CHOICES = [
        ('issued', 'Issued'),
        ('returned', 'Returned'),
    ]

    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name='sports_equipment_issues',
        null=True,
        blank=True,
    )
    equipment = models.ForeignKey(SportEquipment, on_delete=models.CASCADE, related_name='issues')
    issued_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sports_equipment_issues',
    )
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='sports_equipment_issued_by_me',
        null=True,
        blank=True,
    )
    returned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='sports_equipment_returned_by_me',
        null=True,
        blank=True,
    )
    quantity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='issued', db_index=True)
    due_back_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'sports_equipment_issues'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['equipment', 'status']),
            models.Index(fields=['issued_to', 'status']),
        ]

    def __str__(self):
        return f"{self.equipment.name} -> {self.issued_to.username}"

    @property
    def is_overdue(self):
        return self.status == 'issued' and self.due_back_at is not None and self.due_back_at < timezone.now()


class DepartmentSportsRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    ]

    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name='sports_department_requests',
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=180)
    requesting_hod = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sports_requests_created',
    )
    sport = models.ForeignKey(Sport, on_delete=models.CASCADE, related_name='department_requests')
    preferred_court = models.ForeignKey(
        SportCourt,
        on_delete=models.SET_NULL,
        related_name='preferred_department_requests',
        null=True,
        blank=True,
    )
    requested_date = models.DateField()
    requested_start_time = models.TimeField()
    requested_end_time = models.TimeField()
    department = models.CharField(max_length=120)
    year_of_study = models.PositiveSmallIntegerField(null=True, blank=True)
    estimated_players = models.PositiveIntegerField(default=10)
    notes = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='sports_requests_reviewed',
        null=True,
        blank=True,
    )
    allocated_slot = models.ForeignKey(
        CourtSlot,
        on_delete=models.SET_NULL,
        related_name='department_requests',
        null=True,
        blank=True,
    )
    rejection_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sports_department_requests'
        ordering = ['-created_at']

    def __str__(self):
        return self.title
