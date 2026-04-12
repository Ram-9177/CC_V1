"""Placements app models — Phase 7."""

from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import TenantModel
from apps.auth.models import User

class Company(TenantModel):
    """Company hiring from the institution."""
    
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    industry = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    contact_email = models.EmailField()
    contact_phone = models.CharField(max_length=20, blank=True)
    
    class Meta:
        db_table = 'placements_company'
        verbose_name_plural = "Companies"

    def __str__(self):
        return self.name

class JobPosting(TenantModel):
    """Job vacancy published by a company."""
    
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('closed', 'Closed'),
    ]
    
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='jobs')
    title = models.CharField(max_length=200)
    description = models.TextField()
    
    package = models.DecimalField(max_digits=12, decimal_places=2, help_text="Annual CTC in INR")
    location = models.CharField(max_length=200)
    
    # Eligibility JSON: {"min_cgpa": 7.5, "allowed_departments": ["CS", "IT"]}
    eligibility_criteria = models.JSONField(default=dict)
    min_cgpa = models.DecimalField(max_digits=4, decimal_places=2, default=0.0)
    
    application_deadline = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES + [('pending_approval', 'Pending Approval')], default='open')
    
    # Network Economics
    is_alumni_contribution = models.BooleanField(default=False)
    alumni_contributor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='alumni_posted_jobs')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='created_jobs')

    class Meta:
        db_table = 'placements_job'
        ordering = ['-application_deadline']
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'status'], name='job_tenant_status_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='job_tenant_created_idx'),
        ]

    def __str__(self):
        return f"{self.title} @ {self.company.name}"

class Application(TenantModel):
    """Student application for a specific job."""
    
    STATUS_CHOICES = [
        ('applied', 'Applied'),
        ('shortlisted', 'Shortlisted'),
        ('interview', 'Interview'),
        ('selected', 'Selected'),
        ('rejected', 'Rejected'),
    ]
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='job_applications')
    job = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name='applications')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='applied')
    feedback = models.TextField(blank=True, help_text="Feedback from recruiter")
    
    class Meta:
        db_table = 'placements_application'
        unique_together = ['student', 'job']
        ordering = ['-created_at']
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', 'status'], name='app_tenant_status_idx'),
            models.Index(fields=['tenant_id', '-created_at'], name='app_tenant_created_idx'),
        ]

    def __str__(self):
        return f"{self.student.username} -> {self.job.title}"

class Offer(TenantModel):
    """Final offer record for a student."""
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='job_offers')
    job = models.ForeignKey(JobPosting, on_delete=models.CASCADE, related_name='offers')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='offers_made')
    
    package = models.DecimalField(max_digits=12, decimal_places=2)
    offer_letter = models.FileField(upload_to='offers/', null=True, blank=True)
    
    accepted = models.BooleanField(default=False)
    joined = models.BooleanField(default=False)
    
    class Meta:
        db_table = 'placements_offer'
        unique_together = ['student', 'job']
        indexes = [
            # Institutional Composite (God-Level Scaling)
            models.Index(fields=['tenant_id', '-created_at'], name='offer_tenant_created_idx'),
        ]

    def __str__(self):
        return f"Offer for {self.student.username} from {self.company.name}"
