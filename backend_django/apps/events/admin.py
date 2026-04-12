from django.contrib import admin
from .models import Event, EventRegistration

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ['title', 'event_type', 'start_time', 'end_time', 'location', 'status', 'college']
    list_filter = ['event_type', 'status', 'college']

@admin.register(EventRegistration)
class EventRegistrationAdmin(admin.ModelAdmin):
    list_display = ['event', 'student', 'status', 'payment_status', 'created_at']
    list_filter = ['status', 'payment_status']
