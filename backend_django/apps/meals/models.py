"""Meals app models."""
from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User

class Meal(TimestampedModel):
    """Meal model for meal planning."""
    
    MEAL_TYPE_CHOICES = [
        ('breakfast', 'Breakfast'),
        ('lunch', 'Lunch'),
        ('dinner', 'Dinner'),
        ('snacks', 'Snacks'),
    ]
    
    meal_type = models.CharField(max_length=20, choices=MEAL_TYPE_CHOICES)
    meal_date = models.DateField()
    description = models.TextField()
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='meals_created')
    
    # Feedback Requesting
    is_feedback_active = models.BooleanField(default=False)
    feedback_prompt = models.CharField(max_length=255, blank=True, null=True)
    
    # NEW: Chef menu posting capability
    menu_posted = models.BooleanField(default=False)
    posted_at = models.DateTimeField(null=True, blank=True)
    posted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='menus_posted')
    
    class Meta:
        ordering = ['-meal_date', 'meal_type']
        unique_together = ['meal_date', 'meal_type']
        indexes = [models.Index(fields=['-meal_date']), models.Index(fields=['menu_posted'])]
    
    def __str__(self):
        return f"{self.get_meal_type_display()} - {self.meal_date}"


class MealItem(TimestampedModel):
    """Items in a meal."""
    
    meal = models.ForeignKey(Meal, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=100)
    quantity = models.CharField(max_length=50)
    
    class Meta:
        ordering = ['meal']
    
    def __str__(self):
        return f"{self.meal} - {self.name}"


class MealFeedback(TimestampedModel):
    """Feedback on meals - supports both private HR feedback and public surveys."""
    
    RATING_CHOICES = [(i, str(i)) for i in range(1, 6)]
    
    FEEDBACK_TYPE_CHOICES = [
        ('private', 'Private (HR only to Chef)'),
        ('public', 'Public (All students can respond)'),
    ]
    
    meal = models.ForeignKey(Meal, on_delete=models.CASCADE, related_name='feedback')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    rating = models.IntegerField(choices=RATING_CHOICES)
    comment = models.TextField(blank=True)
    
    # NEW: Distinguish between private and public feedback
    feedback_type = models.CharField(
        max_length=20,
        choices=FEEDBACK_TYPE_CHOICES,
        default='private'
    )
    
    # NEW: Track if HR published this as public feedback
    is_published_by_hr = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
        unique_together = ['meal', 'user']
        indexes = [
            models.Index(fields=['meal', 'feedback_type']),
            models.Index(fields=['is_published_by_hr']),
        ]
    
    def __str__(self):
        return f"{self.user} - {self.meal} - {self.rating}⭐"


class MealAttendance(TimestampedModel):
    """Track meal attendance for students."""

    STATUS_CHOICES = [
        ('taken', 'Taken'),
        ('skipped', 'Skipped'),
    ]

    meal = models.ForeignKey(Meal, on_delete=models.CASCADE, related_name='attendance')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='meal_attendance')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='taken')
    marked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-marked_at']
        unique_together = ['meal', 'student']

    def __str__(self):
        return f"{self.student} - {self.meal} - {self.status}"


class MealPreference(TimestampedModel):
    """Store meal preferences per user and meal type."""

    meal_type = models.CharField(max_length=20, choices=Meal.MEAL_TYPE_CHOICES)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='meal_preferences')
    preference = models.CharField(max_length=100, blank=True)
    dietary_restrictions = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ['meal_type', 'user']

    def __str__(self):
        return f"{self.user} - {self.meal_type}"


class MealSpecialRequest(TimestampedModel):
    """Special food requests from students."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('delivered', 'Delivered'),
        ('rejected', 'Rejected'),
    ]
    
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='special_requests')
    item_name = models.CharField(max_length=100)
    quantity = models.IntegerField(default=1)
    requested_for_date = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    notes = models.TextField(blank=True, help_text="Special instructions or extra text")
    
    class Meta:
        ordering = ['-requested_for_date', '-created_at']

    def __str__(self):
        return f"{self.student} - {self.item_name} - {self.status}"


class MenuNotification(TimestampedModel):
    """Menu notifications posted by chef to all students."""
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='menu_notifications_created')
    menu_date = models.DateField()
    menu_text = models.TextField()  # Full menu details
    meal_type = models.CharField(max_length=20, choices=Meal.MEAL_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    published_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-menu_date', '-created_at']
        indexes = [models.Index(fields=['-menu_date', 'status'])]
    
    def __str__(self):
        return f"Menu - {self.menu_date} ({self.get_status_display()})"


class DailyMealReport(TimestampedModel):
    """Daily forecast snapshots indicating the predicted diners vs expected base."""
    
    date = models.DateField()
    meal_type = models.CharField(max_length=20, choices=Meal.MEAL_TYPE_CHOICES)
    
    original_population = models.IntegerField(default=0)
    adjusted_population = models.IntegerField(default=0)
    excluded_count = models.IntegerField(default=0)
    students_marked_absent = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['-date', 'meal_type']
        unique_together = ['date', 'meal_type']
        indexes = [models.Index(fields=['-date', 'meal_type'])]
    
    def __str__(self):
        return f"Forecast: {self.date} {self.get_meal_type_display()} ({self.adjusted_population} diners)"
