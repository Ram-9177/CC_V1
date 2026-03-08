"""Models for Complaints app."""
from django.db import models
from django.utils import timezone
from core.models import TimestampedModel
from apps.auth.models import User

class Complaint(TimestampedModel):
    """Model for tracking maintenance and other complaints."""
    
    SEVERITY_CHOICES = [
        ('URGENT', 'Urgent'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
    ]
    
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
    ]
    
    CATEGORY_CHOICES = [
        ('electrical', 'Electrical'),
        ('plumbing', 'Plumbing'),
        ('carpentry', 'Carpentry'),
        ('cleaning', 'Cleaning'),
        ('internet', 'Internet'),
        ('mess', 'Mess/Food'),
        ('other', 'Other'),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='complaints')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=200)
    description = models.TextField()
    image = models.ImageField(upload_to='complaints/', null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='LOW')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_complaints')
    resolved_at = models.DateTimeField(null=True, blank=True)
    is_overdue = models.BooleanField(default=False)

    class Meta:
        # Default ordering: URGENT first, then by creation date
        ordering = ['severity', '-created_at']
        indexes = [
            models.Index(fields=['status', 'severity']),
            models.Index(fields=['student']),
            models.Index(fields=['category']),
            models.Index(fields=['is_overdue']),
            models.Index(fields=['-created_at']),
        ]


    def save(self, *args, **kwargs):
        if self.status == 'resolved' and not self.resolved_at:
            self.resolved_at = timezone.now()
        super().save(*args, **kwargs)

    def check_sla(self):
        """Check if complaint is overdue based on severity."""
        if self.status == 'resolved':
            return False
            
        now = timezone.now()
        diff = now - self.created_at
        
        sla_hours = {
            'critical': 24,
            'high': 24,
            'medium': 48,
            'low': 72
        }
        
        limit = sla_hours.get(self.severity, 72)
        return diff.total_seconds() > (limit * 3600)

    def __str__(self):
        return f"{self.title} ({self.status})"
