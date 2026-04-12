"""Messages app models."""

from django.db import models
from django.utils import timezone
from core.models import TimestampedModel, TargetedCommunicationModel
from apps.auth.models import User


class Message(TimestampedModel):
    """Direct in-app message between users."""

    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    subject = models.CharField(max_length=200, blank=True)
    body = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'is_read', '-created_at']),
            models.Index(fields=['sender', '-created_at']),
        ]
        db_table = 'messages_message'

    def mark_read(self):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])

    def __str__(self):
        return f"{self.subject or 'Message'} -> {self.recipient}"


class BroadcastMessage(TimestampedModel, TargetedCommunicationModel):
    """Admin/Staff broadcast message to targeted student audiences."""
    
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='broadcasts')
    subject = models.CharField(max_length=200)
    body = models.TextField()
    is_published = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['-created_at']
        db_table = 'messages_broadcast'

    def __str__(self):
        return f"Broadcast: {self.subject} ({self.target_audience})"
