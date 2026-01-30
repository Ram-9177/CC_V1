"""Meals app admin."""
from django.contrib import admin
from apps.meals.models import Meal, MealItem, MealFeedback

@admin.register(Meal)
class MealAdmin(admin.ModelAdmin):
    list_display = ['meal_type', 'meal_date', 'cost', 'created_at']
    list_filter = ['meal_type', 'meal_date']
    search_fields = ['description']

@admin.register(MealItem)
class MealItemAdmin(admin.ModelAdmin):
    list_display = ['name', 'meal', 'quantity']
    list_filter = ['meal']

@admin.register(MealFeedback)
class MealFeedbackAdmin(admin.ModelAdmin):
    list_display = ['user', 'meal', 'rating', 'created_at']
    list_filter = ['rating', 'meal__meal_date']
