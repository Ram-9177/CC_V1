"""Notices models."""

from django.db import models
from core.models import TenantModel, TargetedCommunicationModel
from apps.auth.models import User
from core.constants import AudienceTargets


class Notice(TenantModel, TargetedCommunicationModel):
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
    external_link = models.URLField(max_length=500, null=True, blank=True, help_text="External link (e.g. Google Form)")
    image = models.ImageField(upload_to='notices/', null=True, blank=True)
    
    # Overriding target_audience to merge existing and new choices
    target_audience = models.CharField(
        max_length=50,
        choices=AudienceTargets.CHOICES + [
            ('all', 'Everyone'), 
            ('students', 'Students'), 
            ('wardens', 'Wardens'), 
            ('chefs', 'Chefs'),
            ('staff', 'All Staff'),
            ('admins', 'Administrative Team'),
            ('block', 'Block-Specific')
        ],
        default='all'
    )

    target_building = models.ForeignKey(
        'rooms.Building', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='building_notices'
    )
    
    class Meta:
        ordering = ['-published_date']
        indexes = [
            models.Index(fields=['-published_date'], name='notices_not_publish_0b3a4a_idx'),
            models.Index(fields=['target_audience', 'is_published'], name='notices_not_target__748fc9_idx'),
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'is_published'], name='notice_tenant_publish_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='notice_tenant_created_idx'),
        ]
        db_table = 'notices_notice'
    
    def __str__(self):
        return self.title


class NoticeLog(TenantModel):
    """Log of notices broadcasted to specific roles."""
    notice = models.ForeignKey(Notice, on_delete=models.CASCADE, related_name='logs')
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    target_role = models.CharField(max_length=50) # The audience selected (e.g. 'students', 'staff')
    users_notified_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['-created_at']
        db_table = 'notices_noticelog'
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', '-created_at'], name='noticelog_tenant_created_idx'),
        ]

    def __str__(self):
        return f"{self.notice.title} -> {self.target_role} ({self.users_notified_count} users)"

