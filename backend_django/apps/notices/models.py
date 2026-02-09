"""Notices models."""

from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User


class Notice(TimestampedModel):
    """Model for hostel notices/announcements."""
    
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('urgent', 'Urgent'),
    ]
    
    title = models.CharField(max_length=200)
    content = models.TextField()
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='notices')
    is_published = models.BooleanField(default=True)
    published_date = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    target_audience = models.CharField(
        max_length=50,
        choices=[
            ('all', 'All'), 
            ('students', 'Students'), 
            ('staff', 'Staff'), 
            ('wardens', 'Wardens'), 
            ('chefs', 'Chefs')
        ],
        default='all'
    )
    
    class Meta:
        ordering = ['-published_date']
        indexes = [models.Index(fields=['-published_date'])]
        db_table = 'notices_notice'
    
    def __str__(self):
        return self.title
