"""Models for campus hall management and booking."""

import uuid

from django.core.exceptions import ValidationError
from django.db import models

from apps.auth.models import User
from core.models import TimestampedModel
from core.constants import AudienceTargets


class Hall(TimestampedModel):
    """Manage campus halls that can be booked."""

    hall_id = models.CharField(max_length=50, unique=True)
    hall_name = models.CharField(max_length=150)
    capacity = models.PositiveIntegerField()
    location = models.CharField(max_length=200)
    facilities = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ('open', 'Open'),
            ('maintenance', 'Maintenance'),
            ('closed', 'Closed'),
        ],
        default='open',
    )
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
            models.Index(fields=['status']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(capacity__gt=0),
                name='hall_capacity_gt_zero',
            ),
        ]

    def __str__(self):
        return f"{self.hall_name} ({self.hall_id})"


class HallBooking(TimestampedModel):
    """Booking request for a hall with approval workflow."""
    from core.constants import AudienceTargets



    STATUS_PENDING = 'pending'
    STATUS_APPROVED = 'approved'
    STATUS_REJECTED = 'rejected'
    STATUS_CANCELLED = 'cancelled'

    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_APPROVED, 'Approved'),
        (STATUS_REJECTED, 'Rejected'),
        (STATUS_CANCELLED, 'Cancelled'),
    ]

    college = models.ForeignKey(
        'colleges.College', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='hall_bookings', db_index=True,
    )
    hall = models.ForeignKey(Hall, on_delete=models.CASCADE, related_name='bookings')
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hall_bookings')
    booking_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    event_name = models.CharField(max_length=200)
    department = models.CharField(max_length=100, blank=True, default='')
    expected_participants = models.PositiveIntegerField(null=True, blank=True)
    description = models.TextField(blank=True)
    slot = models.ForeignKey(
        'HallSlot',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bookings',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    qr_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hall_bookings_reviewed',
    )
    review_note = models.CharField(max_length=300, blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    # Event Invitation Targeting Logic
    target_audience = models.CharField(
        max_length=50,
        choices=AudienceTargets.CHOICES + [('all', 'Everyone')], # 'all' is mapped manually if needed
        default=AudienceTargets.ALL_STUDENTS
    )
    target_departments = models.TextField(
        blank=True, default='', help_text="Comma separated list of department names for specific_department targeting."
    )
    target_batches = models.TextField(
        blank=True, default='', help_text="Comma separated list of batch years for specific_year targeting."
    )

    requested_equipment = models.ManyToManyField(
        'HallEquipment',
        through='HallEquipmentBooking',
        related_name='bookings',
        blank=True,
    )

    class Meta:
        db_table = 'hall_booking_booking'
        ordering = ['booking_date', 'start_time']
        indexes = [
            models.Index(fields=['hall', 'booking_date']),
            models.Index(fields=['booking_date', 'status']),
            models.Index(fields=['status', 'booking_date']),
            models.Index(fields=['slot', 'booking_date']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_time__gt=models.F('start_time')),
                name='hall_booking_end_time_gt_start_time',
            ),
            models.CheckConstraint(
                check=models.Q(expected_participants__isnull=True) | models.Q(expected_participants__gt=0),
                name='hall_booking_expected_participants_gt_zero',
            ),
        ]

    def __str__(self):
        return f"{self.event_name} - {self.hall.hall_name} ({self.booking_date})"

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError({'end_time': 'End time must be after start time.'})

        if self.slot_id:
            if self.slot.hall_id != self.hall_id:
                raise ValidationError({'slot': 'Selected slot does not belong to this hall.'})
            if not self.slot.is_active or self.slot.status != HallSlot.STATUS_OPEN:
                raise ValidationError({'slot': 'Selected slot is not available for booking.'})
            # Keep booking window aligned with slot definition.
            self.start_time = self.slot.start_time
            self.end_time = self.slot.end_time

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

        if self.expected_participants and self.expected_participants > self.hall.capacity:
            raise ValidationError({'expected_participants': 'Expected participants exceed hall capacity.'})


class HallSlot(TimestampedModel):
    """Fixed reusable slot definitions for a hall."""

    STATUS_OPEN = 'open'
    STATUS_BLOCKED = 'blocked'

    hall = models.ForeignKey(Hall, on_delete=models.CASCADE, related_name='slots')
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(
        max_length=20,
        choices=[
            (STATUS_OPEN, 'Open'),
            (STATUS_BLOCKED, 'Blocked'),
        ],
        default=STATUS_OPEN,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'hall_booking_slot'
        ordering = ['hall_id', 'start_time']
        indexes = [
            models.Index(fields=['hall', 'is_active']),
            models.Index(fields=['hall', 'start_time']),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_time__gt=models.F('start_time')),
                name='hall_slot_end_time_gt_start_time',
            ),
        ]

    def __str__(self):
        return f"{self.hall.hall_name} {self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}"

    def clean(self):
        if self.end_time <= self.start_time:
            raise ValidationError({'end_time': 'End time must be after start time.'})

        overlaps = HallSlot.objects.filter(
            hall_id=self.hall_id,
            start_time__lt=self.end_time,
            end_time__gt=self.start_time,
            is_active=True,
        )
        if self.pk:
            overlaps = overlaps.exclude(pk=self.pk)
        if overlaps.exists():
            raise ValidationError('Slot overlaps with an existing active slot for this hall.')


class HallEquipment(TimestampedModel):
    """Bookable equipment associated with halls/events."""

    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'hall_booking_equipment'
        ordering = ['name']
        indexes = [
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name


class HallEquipmentBooking(TimestampedModel):
    """Equipment allocations against a hall booking."""

    booking = models.ForeignKey(HallBooking, on_delete=models.CASCADE, related_name='equipment_allocations')
    equipment = models.ForeignKey(HallEquipment, on_delete=models.CASCADE, related_name='allocations')

    class Meta:
        db_table = 'hall_booking_equipment_booking'
        unique_together = [('booking', 'equipment')]
        indexes = [
            models.Index(fields=['equipment', 'booking']),
        ]

    def __str__(self):
        return f"{self.booking.event_name} - {self.equipment.name}"


class HallAttendance(TimestampedModel):
    """Optional QR/manual attendance tracking for hall events."""

    SCAN_QR = 'qr'
    SCAN_MANUAL = 'manual'

    booking = models.ForeignKey(HallBooking, on_delete=models.CASCADE, related_name='attendance_records')
    attendee_name = models.CharField(max_length=150)
    attendee_identifier = models.CharField(max_length=100, blank=True, default='')
    scan_method = models.CharField(
        max_length=10,
        choices=[
            (SCAN_QR, 'QR Code'),
            (SCAN_MANUAL, 'Manual Entry'),
        ],
        default=SCAN_QR,
    )
    scanned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hall_attendance_scans',
    )

    class Meta:
        db_table = 'hall_booking_attendance'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['booking', 'created_at']),
            models.Index(fields=['attendee_identifier']),
        ]

    def __str__(self):
        return f"{self.attendee_name} @ {self.booking.event_name}"
