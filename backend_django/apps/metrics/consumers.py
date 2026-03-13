"""WebSocket consumer for live dashboard metrics."""

import json
from datetime import date

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth.models import AnonymousUser
from django.utils import timezone

from apps.events.models import EventRegistration
from apps.gate_passes.models import GatePass
from apps.hall_booking.models import HallBooking
from apps.leaves.models import LeaveApplication
from apps.notifications.models import Notification
from apps.visitors.models import VisitorLog


AUTHORIZED_ROLES = {
    'admin',
    'super_admin',
    'head_warden',
    'warden',
    'security_head',
    'principal',
    'director',
}


class DashboardConsumer(AsyncWebsocketConsumer):
    """Pushes real-time dashboard snapshot updates to authorized roles."""

    group_name = 'dashboard_admin'

    async def connect(self):
        user = self.scope.get('user', AnonymousUser())
        if not user.is_authenticated:
            await self.accept()
            await self.close(code=4003)
            return

        if getattr(user, 'role', None) not in AUTHORIZED_ROLES:
            await self.accept()
            await self.close(code=4003)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        payload = await self.get_dashboard_data()
        await self.send(text_data=json.dumps(payload))

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def dashboard_update(self, event):
        payload = await self.get_dashboard_data()
        await self.send(text_data=json.dumps(payload))

    @sync_to_async
    def get_dashboard_data(self):
        today = date.today()

        active_gatepasses = GatePass.objects.filter(
            status='approved',
            movement_status='outside',
        ).count()

        recent_notifications = list(
            Notification.objects.order_by('-created_at').values(
                'title', 'created_at', 'notification_type'
            )[:5]
        )

        return {
            'type': 'dashboard_update',
            'active_gatepasses': active_gatepasses,
            'students_outside': active_gatepasses,
            'pending_gatepasses': GatePass.objects.filter(status='pending').count(),
            'sports_bookings_today': EventRegistration.objects.filter(created_at__date=today).count(),
            'pending_hall_bookings': HallBooking.objects.filter(status='pending').count(),
            'recent_notifications': [
                {
                    'title': item['title'],
                    'created_at': item['created_at'].isoformat() if item['created_at'] else None,
                    'notif_type': item['notification_type'],
                }
                for item in recent_notifications
            ],
            'active_visitors': VisitorLog.objects.filter(check_out__isnull=True).count(),
            'pending_leaves': LeaveApplication.objects.filter(status__in=['pending', 'PENDING_APPROVAL']).count(),
            'timestamp': timezone.now().isoformat(),
        }
