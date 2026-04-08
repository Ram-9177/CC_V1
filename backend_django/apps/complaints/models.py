"""Models for Complaints app."""
from django.db import models
from django.utils import timezone
from core.models import TenantModel
from apps.auth.models import User

class Complaint(TenantModel):
    """Model for tracking maintenance and other complaints."""
    
    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('procurement', 'Procurement'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
        ('reopened', 'Reopened'),
        ('invalid', 'Invalid/Fake'),
    ]
    
    CATEGORY_CHOICES = [
        # Hosteller categories
        ('room', 'Room Issue'),
        ('electrical', 'Electrical'),
        ('plumbing', 'Plumbing'),
        ('mess', 'Mess/Food'),
        ('cleaning', 'Cleanliness'),
        # Day Scholar categories
        ('academic', 'Academic'),
        ('faculty', 'Faculty'),
        ('admin', 'Admin'),
        ('other', 'Other'),
    ]

    PRIORITY_CHOICES = [
        ('1', 'Urgent (SLA Trigger)'),
        ('2', 'High'),
        ('3', 'Medium'),
        ('4', 'Low'),
    ]

    VISIT_SLOT_CHOICES = [
        ('anytime', 'Anytime'),
        ('morning', 'Morning (6 AM - 12 PM)'),
        ('afternoon', 'Afternoon (12 PM - 5 PM)'),
        ('evening', 'Evening (5 PM - 10 PM)'),
    ]

    STUDENT_TYPE_CHOICES = [
        ('hosteller', 'Hosteller'),
        ('day_scholar', 'Day Scholar'),
    ]

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='complaints')
    student_type = models.CharField(max_length=20, choices=STUDENT_TYPE_CHOICES, default='hosteller')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    subcategory = models.CharField(max_length=100, blank=True, default='')
    title = models.CharField(max_length=200)
    description = models.TextField()
    image = models.ImageField(upload_to='complaints/', null=True, blank=True)
    location_details = models.CharField(max_length=255, blank=True, default='')
    contact_number = models.CharField(max_length=20, blank=True, default='')
    preferred_visit_slot = models.CharField(max_length=20, choices=VISIT_SLOT_CHOICES, default='anytime')
    allow_room_entry = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    priority = models.CharField(max_length=2, choices=PRIORITY_CHOICES, default='3')
    
    # SLA & Operations
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_complaints')
    expected_resolution_time = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    is_overdue = models.BooleanField(default=False)
    escalation_level = models.PositiveSmallIntegerField(default=0) # 0: None, 1: Warden, 2: Head Warden, 3: Admin

    class Meta:
        # NOTE: Do NOT order by severity string here — alphabetical order
        # (critical > high > low > medium) does NOT match business priority.
        # Correct ordering is handled via Case/When annotation in ComplaintViewSet.get_queryset().
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'priority']),
            models.Index(fields=['student']),
            models.Index(fields=['category']),
            models.Index(fields=['is_overdue']),
            models.Index(fields=['-created_at']),
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'status'], name='comp_tenant_status_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='comp_tenant_created_idx'),
        ]


    def save(self, *args, **kwargs):
        # 1. Capture student type on creation
        if not self.pk and self.student:
            self.student_type = self.student.student_type

        # 2. SLA CALCULATION
        if not self.expected_resolution_time:
            # hostel issue (room, electrical, plumbing, cleaning) → 24 hrs
            # mess issue → 12 hrs
            # academic → 48 hrs
            hours = 24
            if self.category == 'mess':
                hours = 12
            elif self.category == 'academic':
                hours = 48
            
            self.expected_resolution_time = timezone.now() + timezone.timedelta(hours=hours)

        # 3. Status tracking
        if self.status == 'resolved' and not self.resolved_at:
            self.resolved_at = timezone.now()
        
        super().save(*args, **kwargs)

    def check_sla(self):
        """Check if complaint is overdue based on expected resolution time."""
        if self.status in ['resolved', 'closed']:
            return False
        
        if not self.expected_resolution_time:
            return False
            
        is_overdue = timezone.now() > self.expected_resolution_time
        if is_overdue and not self.is_overdue:
            self.is_overdue = True
            self.save(update_fields=['is_overdue'])
        return is_overdue


class ComplaintUpdate(TenantModel):
    """History of status changes and comments on a complaint."""
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='updates')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    status_from = models.CharField(max_length=20)
    status_to = models.CharField(max_length=20)
    comment = models.TextField()
    is_internal = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']
        db_table = 'complaint_updates'
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', '-created_at'], name='compup_tenant_created_idx'),
        ]

    def __str__(self):
        return f"Update on {self.complaint.id} by {self.user.username}"
