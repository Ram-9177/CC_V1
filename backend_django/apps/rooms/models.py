"""Rooms app models."""
from django.db import models
from django.db.models import Q
from core.models import TimestampedModel
from apps.auth.models import User

class Building(TimestampedModel):
    """Building model for hostel blocks."""
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    total_floors = models.IntegerField(default=1)
    
    def __str__(self):
        return f"{self.name} ({self.code})"

class Room(TimestampedModel):
    """Room model for hostel room management."""
    
    ROOM_TYPE_CHOICES = [
        ('single', 'Single'),
        ('double', 'Double'),
        ('triple', 'Triple'),
        ('quad', 'Quad'),
        ('dormitory', 'Dormitory'),
    ]
    
    room_number = models.CharField(max_length=50)
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name='rooms', null=True, blank=True)
    floor = models.IntegerField()
    room_type = models.CharField(max_length=20, choices=ROOM_TYPE_CHOICES)
    capacity = models.IntegerField()
    current_occupancy = models.IntegerField(default=0)
    rent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_available = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    amenities = models.JSONField(default=dict, blank=True)  # Changed default to dict to store config keys like 'bunk_count'
    
    BED_TYPE_CHOICES = [
        ('standard', 'Standard Single'),
        ('bunk', 'Double Tier (Bunk)'),
        ('combined', 'Combined (Mixed)'),
    ]
    bed_type = models.CharField(max_length=20, choices=BED_TYPE_CHOICES, default='standard')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='rooms_created')
    
    class Meta:
        ordering = ['floor', 'room_number']
        indexes = [
            models.Index(fields=['floor', 'room_number']),
            models.Index(fields=['is_available']),
        ]
        unique_together = ['building', 'room_number']
    
    def __str__(self):
        return f"{self.building.code if self.building else ''} - {self.room_number}"


class Bed(TimestampedModel):
    """Bed model for granular room management."""
    
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='beds')
    bed_number = models.CharField(max_length=10)
    is_occupied = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['room', 'bed_number']
        unique_together = ['room', 'bed_number']
        
    def __str__(self):
        return f"{self.room} - Bed {self.bed_number}"


class RoomAllocation(TimestampedModel):
    """Room allocation for students."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('completed', 'Completed'),
    ]
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='room_allocations')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='allocations')
    bed = models.ForeignKey(Bed, on_delete=models.SET_NULL, null=True, blank=True, related_name='allocations')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    allocated_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-allocated_date']
        indexes = [
            # CRITICAL: Optimize "get active allocations" query
            # Used in: room allocation, move operation, dashboard
            models.Index(fields=['student', 'end_date', 'status']),
            models.Index(fields=['room', 'end_date', 'status']),
            models.Index(fields=['bed', 'end_date']),
            models.Index(fields=['status', 'allocated_date']),
        ]
        constraints = [
            # A student can have only one active allocation at a time.
            models.UniqueConstraint(
                fields=['student'],
                condition=Q(end_date__isnull=True),
                name='rooms_unique_active_allocation_per_student',
            ),
            # A bed can have only one active allocation at a time.
            # (Multiple NULL beds are allowed for legacy allocations.)
            models.UniqueConstraint(
                fields=['bed'],
                condition=Q(end_date__isnull=True),
                name='rooms_unique_active_allocation_per_bed',
            ),
        ]
    
    def __str__(self):
        return f"{self.student} - {self.room}"
