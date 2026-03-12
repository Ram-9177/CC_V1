"""Notifications views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin
from .models import Notification, NotificationPreference, WebPushSubscription
from .serializers import NotificationSerializer, NotificationPreferenceSerializer, WebPushSubscriptionSerializer
from rest_framework.views import APIView
from websockets.broadcast import notify_unread_count_changed
from core.throttles import NotificationBulkThrottle


class NotificationViewSet(viewsets.ModelViewSet):
    """ViewSet for Notifications."""
    
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """
        Return notifications for current user.
        Includes personal notifications and global targeted notifications.
        """
        user = self.request.user
        from django.db.models import Q
        from core.filters import AudienceFilterMixin
        
        # Base: personal notifications
        qs = Notification.objects.filter(recipient=user)
        
        # Audience logic: fetch matching global notifications
        global_qs = Notification.objects.filter(recipient__isnull=True)
        global_qs = AudienceFilterMixin().filter_audience(self.request, global_qs)
        
        # Combine and order
        return (qs | global_qs).distinct().order_by('-created_at')
    
    @action(detail=False, methods=['get'])
    def unread(self, request):
        """Get unread notifications."""
        notifications = self.get_queryset().filter(is_read=False)
        page = self.paginate_queryset(notifications)
        if page is not None:
             serializer = self.get_serializer(page, many=True)
             return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(notifications, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def mark_as_read(self, request, pk=None):
        """Mark notification as read."""
        notification = self.get_object()
        if not notification.is_read:
            notification.is_read = True
            notification.save(update_fields=['is_read'])
            notify_unread_count_changed(request.user.id, -1)
        serializer = self.get_serializer(notification)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'], throttle_classes=[NotificationBulkThrottle])
    def mark_all_as_read(self, request):
        """Mark all notifications as read."""
        # Fix: Cannot call .update() on a sliced queryset.
        # Fix: Cannot call .update() on a sliced queryset.
        # Use a fresh filter without the slice limit in get_queryset.
        unread = Notification.objects.filter(recipient=request.user, is_read=False)
        count = unread.count()
        unread.update(is_read=True)
        # Notify client to clear badge (using 0 or negative delta)
        # We can send -count to be precise.
        notify_unread_count_changed(request.user.id, -count)
        return Response({'status': f'{count} notifications marked as read'})
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications."""
        # Fix: Cannot call count on sliced queryset reliably/efficiently
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({'unread_count': count, 'count': count})


class NotificationPreferenceViewSet(viewsets.ModelViewSet):
    """ViewSet for Notification Preferences."""
    
    serializer_class = NotificationPreferenceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Return preference for current user."""
        return NotificationPreference.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get', 'put'])
    def my_preferences(self, request):
        """Get or update current user's preferences."""
        preference, _ = NotificationPreference.objects.get_or_create(user=request.user)
        
        if request.method == 'PUT':
            serializer = self.get_serializer(preference, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
        else:
            serializer = self.get_serializer(preference)
        
        return Response(serializer.data)

class WebPushSubscriptionView(APIView):
    """Endpoint for devices to register for Web Push limits."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = WebPushSubscriptionSerializer(data=request.data)
        if serializer.is_valid():
            # Create or update subscription by endpoint
            subscription, created = WebPushSubscription.objects.update_or_create(
                endpoint=serializer.validated_data['endpoint'],
                defaults={
                    'user': request.user,
                    'auth_key': serializer.validated_data['auth_key'],
                    'p256dh_key': serializer.validated_data['p256dh_key']
                }
            )
            return Response({"status": "subscribed", "created": created}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
