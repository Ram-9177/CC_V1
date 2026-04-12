"""Resume Builder models."""
from django.db import models
from django.utils import timezone
from core.models import TimestampedModel
from apps.auth.models import User

TEMPLATE_CHOICES = [
    ('classic', 'Classic'),
    ('modern', 'Modern'),
    ('compact', 'Compact'),
    ('student_focus', 'Student Focus'),
]


class ResumeProfile(TimestampedModel):
    """Stores a student's resume data and generated output."""

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='resume_profile'
    )
    college = models.ForeignKey(
        'colleges.College', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='resume_profiles', db_index=True,
    )

    # Personal info
    full_name = models.CharField(max_length=200, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    linkedin = models.URLField(blank=True)
    github = models.URLField(blank=True)

    # Academic
    course = models.CharField(max_length=100, blank=True)
    branch = models.CharField(max_length=100, blank=True)
    year = models.CharField(max_length=20, blank=True)

    # Resume sections (raw input from student)
    skills = models.JSONField(default=list, blank=True)
    education = models.JSONField(default=list, blank=True)
    projects = models.JSONField(default=list, blank=True)
    experience = models.JSONField(default=list, blank=True)
    achievements = models.JSONField(default=list, blank=True)
    certifications = models.JSONField(default=list, blank=True)
    summary = models.TextField(blank=True)

    # Template & AI output
    selected_template = models.CharField(
        max_length=30, choices=TEMPLATE_CHOICES, default='classic'
    )
    generated_resume = models.JSONField(null=True, blank=True)
    last_generated_at = models.DateTimeField(null=True, blank=True)

    # Rate limiting: track daily generation count
    generation_date = models.DateField(null=True, blank=True)
    generation_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['college']),
        ]

    def __str__(self):
        return f"Resume: {self.user.username}"

    def can_generate(self) -> bool:
        """Allow max 3 AI generations per day."""
        today = timezone.now().date()
        if self.generation_date != today:
            return True
        return self.generation_count < 3

    def record_generation(self):
        today = timezone.now().date()
        if self.generation_date != today:
            self.generation_date = today
            self.generation_count = 1
        else:
            self.generation_count += 1
        self.last_generated_at = timezone.now()
        self.save(update_fields=['generation_date', 'generation_count', 'last_generated_at'])
