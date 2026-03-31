"""Sports app models with legacy support and new Phase 5 features."""
from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User
import uuid

# --- Legacy Models (Required by apps.events and other dependencies) ---

class Sport(TimestampedModel):
    name = models.CharField(max_length=100, unique=True)
    min_players = models.PositiveIntegerField(default=1)
    max_players = models.PositiveIntegerField(default=10)
    GAME_TYPE_CHOICES = [
        ("singles", "Singles"),
        ("doubles", "Doubles"),
        ("team", "Team"),
        ("mixed", "Mixed"),
    ]
    game_type = models.CharField(max_length=20, choices=GAME_TYPE_CHOICES, default="team")
    STATUS_CHOICES = [("active", "Active"), ("inactive", "Inactive")]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    icon = models.CharField(max_length=50, blank=True, help_text="Emoji or icon name, e.g. 🏸")
    description = models.TextField(blank=True)

    class Meta:
        db_table = "sports_sport"
        ordering = ["name"]
    def __str__(self): return self.name

class SportCourt(TimestampedModel):
    sport = models.ForeignKey(Sport, on_delete=models.CASCADE, related_name="courts")
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200, blank=True)
    capacity = models.PositiveIntegerField(default=10)
    STATUS_CHOICES = [
        ("open", "Open"),
        ("maintenance", "Under Maintenance"),
        ("closed", "Closed"),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="open")
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "sports_court"
        ordering = ["sport__name", "name"]
    def __str__(self): return f"{self.sport.name} - {self.name}"

class CourtSlot(TimestampedModel):
    court = models.ForeignKey(SportCourt, on_delete=models.CASCADE, related_name="slots")
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    max_players = models.PositiveIntegerField()
    notes = models.CharField(blank=True, max_length=200)

    class Meta:
        db_table = "sports_courtslot"
        unique_together = ["court", "date", "start_time"]
        ordering = ["date", "start_time"]
    def __str__(self): return f"{self.court.name} @ {self.date} {self.start_time}"

class SportBooking(TimestampedModel):
    slot = models.ForeignKey(CourtSlot, on_delete=models.CASCADE, related_name="bookings")
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sport_bookings")
    STATUS_CHOICES = [
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
        ("attended", "Attended"),
        ("no_show", "No Show"),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="confirmed", db_index=True)
    qr_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    check_in_time = models.DateTimeField(null=True, blank=True)
    checked_in_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="sport_checkins")

    class Meta:
        db_table = "sports_booking"
        unique_together = ["slot", "student"]
        ordering = ["-created_at"]
    def __str__(self): return f"{self.student.username} - {self.slot}"

# --- New Phase 5 Models ---

class SportFacility(TimestampedModel):
    """Generic sports facilities (Pool, Gym, etc.)"""
    name = models.CharField(max_length=100)
    description = models.TextField()
    is_active = models.BooleanField(default=True)
    location = models.CharField(max_length=255, blank=True)
    class Meta:
        verbose_name_plural = "Sport Facilities"
    def __str__(self): return self.name

class SportsMatch(TimestampedModel):
    """Competitive matches."""
    facility = models.ForeignKey(SportFacility, on_delete=models.SET_NULL, null=True, blank=True)
    legacy_court = models.ForeignKey(SportCourt, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=150)
    match_date = models.DateTimeField()
    organizer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='exclusive_matches_organized')
    team_a_name = models.CharField(max_length=100)
    team_b_name = models.CharField(max_length=100)
    score_a = models.IntegerField(default=0)
    score_b = models.IntegerField(default=0)
    is_completed = models.BooleanField(default=False)
    summary = models.TextField(blank=True)
    class Meta:
        verbose_name_plural = "Sports Matches"
    def __str__(self): return f"{self.title} - {self.match_date}"

# Other legacy models required for consistency
class SportsPolicy(TimestampedModel):
    max_bookings_per_day = models.PositiveIntegerField(default=1)
    max_bookings_per_week = models.PositiveIntegerField(default=3)
    allow_same_sport_same_day = models.BooleanField(default=False)
    booking_window_days = models.PositiveIntegerField(default=7)
    class Meta:
        db_table = "sports_policy"

class SportAttendance(TimestampedModel):
    booking = models.OneToOneField(SportBooking, on_delete=models.CASCADE, related_name="attendance_record")
    scanned_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name="sports_attendances")
    notes = models.CharField(blank=True, max_length=200)
    class Meta:
        db_table = "sports_attendance"

class DepartmentSportsRequest(TimestampedModel):
    title = models.CharField(max_length=200)
    requested_date = models.DateField()
    sport = models.ForeignKey(Sport, on_delete=models.CASCADE, related_name="dept_requests")
    department = models.CharField(max_length=100)
    requesting_hod = models.ForeignKey(User, on_delete=models.CASCADE, related_name="dept_sports_requests")
    status = models.CharField(max_length=20, default='pending')
    class Meta:
        db_table = "sports_dept_request"
