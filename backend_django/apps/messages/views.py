"""Messages views."""
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.cache import cache
from apps.notifications.utils import notify_user, notify_targeted_students
from websockets.broadcast import broadcast_to_updates_user, broadcast_to_role
from .models import Message, BroadcastMessage
from .serializers import MessageSerializer, BroadcastMessageSerializer
from core.filters import AudienceFilterMixin
from core.permissions import IsAdmin, IsWarden
from core import cache_keys as ck


class MessageViewSet(viewsets.ModelViewSet):
    """ViewSet for in-app messages."""

    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    @staticmethod
    def _unread_cache_key(user_id: int) -> str:
        return f"{ck.permissions_user(user_id)}:msg_unread"

    def get_queryset(self):
        user = self.request.user
        box = self.request.query_params.get('box', 'inbox')
        base_queryset = Message.objects.select_related('sender', 'recipient')
        if box == 'sent':
            return base_queryset.filter(sender=user)
        return base_queryset.filter(recipient=user)

    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)

        notification_title = f"New message from {self.request.user.get_full_name() or self.request.user.username}"
        notify_user(
            message.recipient,
            notification_title,
            message.subject or message.body[:120],
            'info',
            '/messages'
        )
        cache.delete(self._unread_cache_key(message.recipient_id))
        broadcast_to_updates_user(message.recipient_id, 'messages_updated', {'resource': 'messages'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        message = self.get_object()
        if message.recipient != request.user:
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        message.mark_read()
        cache.delete(self._unread_cache_key(request.user.id))
        broadcast_to_updates_user(request.user.id, 'messages_updated', {'resource': 'messages'})
        serializer = self.get_serializer(message)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        cache_key = self._unread_cache_key(request.user.id)
        count = cache.get(cache_key)
        if count is None:
            count = Message.objects.filter(recipient=request.user, is_read=False).count()
            cache.set(cache_key, count, 30)
        return Response({'unread_count': count})


class BroadcastMessageViewSet(viewsets.ModelViewSet):
    """ViewSet for broadcast messages."""
    
    queryset = BroadcastMessage.objects.filter(is_published=True).select_related('sender')
    serializer_class = BroadcastMessageSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAdmin() | IsWarden()]
        return super().get_permissions()

    def get_queryset(self):
        qs = super().get_queryset()
        return AudienceFilterMixin().filter_audience(self.request, qs)

    def perform_create(self, serializer):
        user = self.request.user
        target_audience = self.request.data.get('target_audience', 'all_students')
        
        # Enforce Role-Based Audience Restrictions
        if user.role == 'warden' and target_audience != 'hostellers':
             target_audience = 'hostellers' # Wardens only for hostellers
             
        broadcast = serializer.save(
            sender=user,
            target_audience=target_audience
        )
        
        # Trigger Notifications
        notif_title = f"📢 New Announcement: {broadcast.subject}"
        notif_message = broadcast.body[:150] + ('...' if len(broadcast.body) > 150 else '')
        notify_targeted_students(target_audience, notif_title, notif_message, 'info', action_url='/messages')
        
        # Websocket Broadcast
        payload = self.get_serializer(broadcast).data
        for role in ['student', 'staff', 'warden', 'admin']:
            broadcast_to_role(role, 'broadcast_created', payload)
