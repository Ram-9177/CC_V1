"""Notifications app models."""

from django.db import models
from core.models import TimestampedModel, TargetedCommunicationModel
from apps.auth.models import User


class Notification(TimestampedModel, TargetedCommunicationModel):
    """Model for user notifications."""
    
    NOTIFICATION_TYPES = [
        ('alert', 'Alert'),
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]
    
    college = models.ForeignKey(
        'colleges.College', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='notifications', db_index=True,
    )
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications', null=True, blank=True)
    title = models.CharField(max_length=200)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES)
    is_read = models.BooleanField(default=False)
    action_url = models.CharField(max_length=500, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['recipient', 'is_read']), 
            models.Index(fields=['target_audience', '-created_at']),
        ]
        db_table = 'notifications_notification'
    
    def __str__(self):
        return f"{self.title} - {self.recipient}"


class NotificationPreference(TimestampedModel):
    """User notification preferences."""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_preference')
    email_alerts = models.BooleanField(default=True)
    email_info = models.BooleanField(default=True)
    push_alerts = models.BooleanField(default=True)
    push_info = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'notifications_preference'
    
    def __str__(self):
        return f"Preferences - {self.user}"

class WebPushSubscription(TimestampedModel):
    """Store web push subscription details mapped to users."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.URLField(max_length=1500, unique=True)
    auth_key = models.CharField(max_length=255)
    p256dh_key = models.CharField(max_length=255)

    class Meta:
        db_table = 'notifications_webpush_subscription'

    def __str__(self):
        return f"Push Sub - {self.user.username}"
