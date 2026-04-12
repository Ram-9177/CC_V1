from django.contrib import admin
from .models import AlumniProfile, Mentorship

@admin.register(AlumniProfile)
class AlumniProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'graduation_year', 'department', 'current_company', 'is_mentor']
    list_filter = ['graduation_year', 'department', 'is_active', 'is_mentor']
    search_fields = ['user__username', 'current_company']

@admin.register(Mentorship)
class MentorshipAdmin(admin.ModelAdmin):
    list_display = ['mentor', 'student', 'status', 'created_at']
    list_filter = ['status']
    search_fields = ['mentor__username', 'student__username']
