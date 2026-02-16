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
    
    STATUS_CHOICES = [
        ('available', 'Available'),
        ('full', 'Full'),
        ('under_maintenance', 'Under Maintenance'),
    ]
    
    room_number = models.CharField(max_length=50)
    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name='rooms', null=True, blank=True)
    floor = models.IntegerField()
    room_type = models.CharField(max_length=20, choices=ROOM_TYPE_CHOICES)
    capacity = models.IntegerField()
    current_occupancy = models.IntegerField(default=0)
    rent = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    is_available = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    description = models.TextField(blank=True)
    amenities = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True, help_text="Administrative notes for the room.")
    
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
            models.Index(fields=['status']),
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
    """Room allocation for students. Keeps backward compat with end_date/approved."""
    
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
    allocated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='allocations_made')
    
    class Meta:
        ordering = ['-allocated_date']
        indexes = [
            models.Index(fields=['student', 'end_date', 'status']),
            models.Index(fields=['room', 'end_date', 'status']),
            models.Index(fields=['bed', 'end_date']),
            models.Index(fields=['status', 'allocated_date']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['student'],
                condition=Q(end_date__isnull=True),
                name='rooms_unique_active_allocation_per_student',
            ),
            models.UniqueConstraint(
                fields=['bed'],
                condition=Q(end_date__isnull=True),
                name='rooms_unique_active_allocation_per_bed',
            ),
        ]
    
    def __str__(self):
        return f"{self.student} - {self.room}"


class RoomAllocationHistory(TimestampedModel):
    """Historical log of all room allocation changes for audit trail."""
    
    ACTION_CHOICES = [
        ('allocated', 'Allocated'),
        ('deallocated', 'Deallocated'),
        ('moved', 'Moved'),
    ]
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='room_history')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    from_room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_from')
    to_room = models.ForeignKey(Room, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_to')
    from_bed = models.ForeignKey(Bed, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_from')
    to_bed = models.ForeignKey(Bed, on_delete=models.SET_NULL, null=True, blank=True, related_name='history_to')
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='room_changes_made')
    details = models.TextField(blank=True, help_text="Details of the change.")
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.student} - {self.action} on {self.created_at.strftime('%Y-%m-%d') if self.created_at else 'N/A'}"
