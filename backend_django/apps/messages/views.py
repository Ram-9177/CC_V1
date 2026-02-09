"""Messages views."""

from django.db.models import Q
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.notifications.models import Notification
from .models import Message
from .serializers import MessageSerializer
from websockets.broadcast import broadcast_to_updates_user


class MessageViewSet(viewsets.ModelViewSet):
    """ViewSet for in-app messages."""

    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        box = self.request.query_params.get('box', 'inbox')
        base_queryset = Message.objects.filter(Q(sender=user) | Q(recipient=user))

        if box == 'sent':
            return base_queryset.filter(sender=user)
        return base_queryset.filter(recipient=user)

    def perform_create(self, serializer):
        message = serializer.save(sender=self.request.user)

        notification_title = f"New message from {self.request.user.get_full_name() or self.request.user.username}"
        Notification.objects.create(
            recipient=message.recipient,
            title=notification_title,
            message=message.subject or message.body[:120],
            notification_type='info',
            action_url='/messages',
        )
        broadcast_to_updates_user(message.recipient_id, 'messages_updated', {'resource': 'messages'})

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        message = self.get_object()
        if message.recipient != request.user:
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        message.mark_read()
        broadcast_to_updates_user(request.user.id, 'messages_updated', {'resource': 'messages'})
        serializer = self.get_serializer(message)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = Message.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'unread_count': count})
