"""Base model classes."""

from django.db import models
from django.utils import timezone


from core.constants import AudienceTargets

class TargetedCommunicationModel(models.Model):
    """Mixin to add target audience tracking to any communication model."""
    target_audience = models.CharField(
        max_length=50,
        choices=AudienceTargets.CHOICES + [('all', 'Everyone')], # Keep 'all' for backward compatibility in Notices
        default=AudienceTargets.ALL_STUDENTS
    )

    class Meta:
        abstract = True

class TimestampedModel(models.Model):
    """Base model with timestamp fields."""
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True, default=None, db_index=True)
    
    class Meta:
        abstract = True
    
    def soft_delete(self):
        """Soft delete the instance."""
        self.deleted_at = timezone.now()
        self.save()
    
    def restore(self):
        """Restore a soft-deleted instance."""
        self.deleted_at = None
        self.save()
