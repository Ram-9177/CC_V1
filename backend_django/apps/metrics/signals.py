from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from apps.auth.models import User
from apps.rooms.models import Room, RoomAllocation
from apps.gate_passes.models import GatePass
from apps.complaints.models import Complaint
from apps.leaves.models import LeaveApplication
from apps.attendance.models import Attendance
from apps.events.models import Event, EventRegistration
from apps.notices.models import Notice
from apps.meals.models import MealSpecialRequest
from apps.hall_booking.models import HallBooking
from apps.visitors.models import VisitorLog

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
        "metrics:security_head:v2",
    ]
    for key in cache_keys:
        cache.delete(key)

    try:
        if hasattr(cache, 'delete_pattern'):
            cache.delete_pattern('metrics:dashboard:*:v2')
            cache.delete_pattern('metrics:analytics:*')
    except Exception:
        pass


@receiver([post_save, post_delete], sender=GatePass)
@receiver([post_save, post_delete], sender=HallBooking)
@receiver([post_save, post_delete], sender=VisitorLog)
@receiver([post_save, post_delete], sender=LeaveApplication)
@receiver([post_save, post_delete], sender=EventRegistration)
def broadcast_dashboard_updates(sender, **kwargs):
    """Trigger real-time dashboard refresh for dashboard_admin group."""
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    async_to_sync(channel_layer.group_send)(
        'dashboard_admin',
        {'type': 'dashboard.update'},
    )
