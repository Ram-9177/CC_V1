"""Messages views."""
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.cache import cache
from apps.notifications.service import NotificationService
from websockets.broadcast import broadcast_to_updates_user, broadcast_to_role
from .models import Message, BroadcastMessage
from .serializers import MessageSerializer, BroadcastMessageSerializer
from core.filters import AudienceFilterMixin
from core.permissions import IsAdmin, IsWarden, user_is_top_level_management
from core.college_mixin import CollegeScopeMixin
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
        recipient = serializer.validated_data.get('recipient')
        sender = self.request.user
        
        # Institutional Lockdown: Recipient MUST be in the same college (unless superadmin)
        if not user_is_top_level_management(sender):
            if getattr(recipient, 'college_id', None) != getattr(sender, 'college_id', None):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("You cannot send messages to users outside your institution.")
        
        message = serializer.save(sender=sender)

        notification_title = f"New message from {sender.get_full_name() or sender.username}"
        NotificationService.send(
            user=message.recipient,
            title=notification_title,
            message=message.subject or message.body[:120],
            notif_type='info',
            action_url='/messages',
            college=getattr(sender, 'college', None)
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


class BroadcastMessageViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
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
        
        # Trigger Notifications with Institutional Scoping
        notif_title = f"📢 New Announcement: {broadcast.subject}"
        notif_message = broadcast.body[:150] + ('...' if len(broadcast.body) > 150 else '')
        NotificationService.send_to_audience(
            target_audience, 
            notif_title, 
            notif_message, 
            'info', 
            action_url='/messages',
            college_id=user.college_id
        )
        
        # Websocket Broadcast
        payload = self.get_serializer(broadcast).data
        for role in ['student', 'staff', 'warden', 'admin']:
            broadcast_to_role(role, 'broadcast_created', payload)
