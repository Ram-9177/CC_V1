"""Notifications serializers."""

from rest_framework import serializers
from .models import Notification, NotificationPreference, WebPushSubscription
from apps.auth.serializers import UserSerializer


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model."""
    
    class Meta:
        model = Notification
        fields = ['id', 'recipient', 'title', 'message', 'notification_type',
                  'is_read', 'action_url', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    """Serializer for NotificationPreference."""
    user_details = UserSerializer(source='user', read_only=True)
    
    class Meta:
        model = NotificationPreference
        fields = ['id', 'user', 'user_details', 'email_alerts', 'email_info',
                  'push_alerts', 'push_info', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class WebPushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebPushSubscription
        fields = ['endpoint', 'auth_key', 'p256dh_key']
        # User is attached in the view
