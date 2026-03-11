from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from .models import RoomAllocation, Bed, Room

@receiver(post_delete, sender=RoomAllocation)
def on_allocation_delete(sender, instance, **kwargs):
    """
    When a RoomAllocation is deleted (e.g. via student deletion CASCADE), 
    ensure the bed is freed and room occupancy is updated.
    """
    if instance.bed:
        bed = instance.bed
        # Check if there are ANY other active approved allocations for this bed
        has_other_active = RoomAllocation.objects.filter(
            bed=bed, 
            status='approved', 
            end_date__isnull=True
        ).exists()
        
        if not has_other_active:
            bed.is_occupied = False
            bed.save(update_fields=['is_occupied'])
            
    if instance.room:
        room = instance.room
        actual_occupancy = RoomAllocation.objects.filter(
            room=room, 
            status='approved', 
            end_date__isnull=True
        ).count()
        room.current_occupancy = actual_occupancy
        room.save(update_fields=['current_occupancy'])


from apps.auth.models import User
from .services import auto_allocate_student
from django.db import transaction

@receiver(post_save, sender=User)
def on_student_approved_or_added(sender, instance, created, **kwargs):
    """
    Ensure the allocation runs automatically when a student is approved or added.
    Uses transaction.on_commit so the allocation runs AFTER the User save commits —
    not during it — preventing "cannot execute queries in atomic block" errors.
    """
    if instance.role == 'student' and getattr(instance, 'is_approved', False) and instance.is_active:
        if not RoomAllocation.objects.filter(student=instance, end_date__isnull=True).exists():
            def _allocate():
                import logging
                _logger = logging.getLogger(__name__)
                success, msg = auto_allocate_student(instance)
                if success:
                    _logger.info(f"Signal auto-allocated student {instance.id}")
                else:
                    _logger.warning(f"Signal auto-allocate failed for student {instance.id}: {msg}")

            transaction.on_commit(_allocate)
