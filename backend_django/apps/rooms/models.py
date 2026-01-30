"""Rooms app models."""
from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User

class Room(TimestampedModel):
    """Room model for hostel room management."""
    
    ROOM_TYPE_CHOICES = [
        ('single', 'Single'),
        ('double', 'Double'),
        ('triple', 'Triple'),
        ('quad', 'Quad'),
    ]
    
    room_number = models.CharField(max_length=50, unique=True)
    floor = models.IntegerField()
    room_type = models.CharField(max_length=20, choices=ROOM_TYPE_CHOICES)
    capacity = models.IntegerField()
    current_occupancy = models.IntegerField(default=0)
    rent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_available = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    amenities = models.JSONField(default=list, blank=True)  # e.g., ['AC', 'WiFi', 'Bed']
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='rooms_created')
    
    class Meta:
        ordering = ['floor', 'room_number']
        indexes = [
            models.Index(fields=['floor', 'room_number']),
            models.Index(fields=['is_available']),
        ]
    
    def __str__(self):
        return f"Room {self.room_number}"


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
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    allocated_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-allocated_date']
        unique_together = ['room', 'allocated_date']
    
    def __str__(self):
        return f"{self.student} - {self.room}"
