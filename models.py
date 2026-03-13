"""Sports System Models."""

from django.db import models
from django.conf import settings
from core.models import TimestampedModel
import uuid

class Sport(TimestampedModel):
    """Defines a sport type (e.g., Badminton, Cricket)."""
    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, default='activity', help_text="Lucide icon name")
    min_players = models.PositiveIntegerField(default=2, help_text="Min players to mark match ready")
    max_players = models.PositiveIntegerField(default=4, help_text="Max capacity per slot")
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)

    def __str__(self):
        return self.name

class SportCourt(TimestampedModel):
    """Physical location for a sport."""
    sport = models.ForeignKey(Sport, on_delete=models.CASCADE, related_name='courts')
    name = models.CharField(max_length=100, help_text="e.g., Badminton Court 1")
    location = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.name} ({self.sport.name})"

class CourtSlot(TimestampedModel):
    """Time slots for specific courts."""
    court = models.ForeignKey(SportCourt, on_delete=models.CASCADE, related_name='slots')
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['start_time']
        unique_together = ['court', 'start_time', 'end_time']

    def __str__(self):
        return f"{self.court.name}: {self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}"

class SportsPolicy(TimestampedModel):
    """Global configuration for booking limits."""
    max_bookings_per_day = models.PositiveIntegerField(default=1)
    max_bookings_per_week = models.PositiveIntegerField(default=3)
    penalty_days_for_no_show = models.PositiveIntegerField(default=2)

    class Meta:
        verbose_name_plural = "Sports Policies"

class SportBooking(TimestampedModel):
    """Student booking for a specific slot."""
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'), # Slot secured
        ('match_ready', 'Match Ready'), # Min players reached
        ('checked_in', 'Checked In'), # QR Scanned
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]

    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sport_bookings')
    slot = models.ForeignKey(CourtSlot, on_delete=models.CASCADE, related_name='bookings')
    booking_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='confirmed')
    qr_code = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    check_in_time = models.DateTimeField(null=True, blank=True)
    checked_in_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='verified_sport_bookings',
        help_text="PT or Security who scanned the QR"
    )

    class Meta:
        unique_together = ['student', 'slot', 'booking_date']
        indexes = [
            models.Index(fields=['booking_date', 'status']),
            models.Index(fields=['student', 'booking_date']),
        ]

    def __str__(self):
        return f"{self.student} - {self.slot} ({self.booking_date})"

# --- Tournament System ---

class Tournament(TimestampedModel):
    """Tournament definition."""
    name = models.CharField(max_length=200)
    sport = models.ForeignKey(Sport, on_delete=models.CASCADE)
    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class TournamentTeam(TimestampedModel):
    """Team participating in a tournament."""
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='teams')
    name = models.CharField(max_length=100)
    captain = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='captained_teams')
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='tournament_teams')
    
    def __str__(self):
        return f"{self.name} ({self.tournament.name})"

class TournamentMatch(TimestampedModel):
    """Match between two teams."""
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name='matches')
    team_a = models.ForeignKey(TournamentTeam, on_delete=models.CASCADE, related_name='matches_as_a')
    team_b = models.ForeignKey(TournamentTeam, on_delete=models.CASCADE, related_name='matches_as_b')
    start_time = models.DateTimeField()
    location = models.CharField(max_length=200)
    score_a = models.IntegerField(default=0)
    score_b = models.IntegerField(default=0)
    winner = models.ForeignKey(TournamentTeam, on_delete=models.SET_NULL, null=True, blank=True, related_name='won_matches')
    status = models.CharField(max_length=20, default='scheduled', choices=[
        ('scheduled', 'Scheduled'), ('live', 'Live'), ('completed', 'Completed')
    ])

    def __str__(self):
        return f"{self.team_a} vs {self.team_b}"