"""Notifications app models."""

from django.db import models
from core.models import TenantModel, TargetedCommunicationModel
from apps.auth.models import User


class Notification(TenantModel, TargetedCommunicationModel):
    """Model for user notifications."""
    
    NOTIFICATION_TYPES = [
        ('alert', 'Alert'),
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('error', 'Error'),
    ]
    
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
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'is_read'], name='notif_tenant_read_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='notif_tenant_created_idx'),
        ]
        db_table = 'notifications_notification'
    
    def __str__(self):
        return f"{self.title} - {self.recipient}"


class NotificationPreference(TenantModel):
    """User notification preferences."""
    
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='notification_preference')
    email_alerts = models.BooleanField(default=True)
    email_info = models.BooleanField(default=True)
    push_alerts = models.BooleanField(default=True)
    push_info = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'notifications_preference'
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'user'], name='notifpref_tenant_user_idx'),
        ]
    
    def __str__(self):
        return f"Preferences - {self.user}"

class WebPushSubscription(TenantModel):
    """Store web push subscription details mapped to users."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.URLField(max_length=1500, unique=True)
    auth_key = models.CharField(max_length=255)
    p256dh_key = models.CharField(max_length=255)

    class Meta:
        db_table = 'notifications_webpush_subscription'

    def __str__(self):
        return f"Push Sub - {self.user.username}"
