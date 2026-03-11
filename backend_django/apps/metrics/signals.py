from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

from apps.auth.models import User
from apps.rooms.models import Room, RoomAllocation
from apps.gate_passes.models import GatePass
from apps.complaints.models import Complaint
from apps.leaves.models import LeaveApplication
from apps.attendance.models import Attendance
from apps.events.models import Event
from apps.notices.models import Notice
from apps.meals.models import MealSpecialRequest

@receiver([post_save, post_delete], sender=User)
@receiver([post_save, post_delete], sender=Room)
@receiver([post_save, post_delete], sender=RoomAllocation)
@receiver([post_save, post_delete], sender=GatePass)
@receiver([post_save, post_delete], sender=Complaint)
@receiver([post_save, post_delete], sender=LeaveApplication)
@receiver([post_save, post_delete], sender=Attendance)
@receiver([post_save, post_delete], sender=Event)
@receiver([post_save, post_delete], sender=Notice)
@receiver([post_save, post_delete], sender=MealSpecialRequest)
def invalidate_dashboard_metrics(sender, **kwargs):
    """
    Invalidate the global dashboard metrics cache when relevant data changes.
    """
    cache_keys = [
        "metrics:dashboard:global:v2",
        "metrics:security_head:v2"
    ]
    for key in cache_keys:
        cache.delete(key)
