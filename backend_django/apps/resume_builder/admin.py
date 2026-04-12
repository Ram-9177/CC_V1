from django.contrib import admin
from .models import ResumeProfile


@admin.register(ResumeProfile)
class ResumeProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'full_name', 'selected_template', 'last_generated_at', 'generation_count']
    list_filter = ['selected_template', 'college']
    search_fields = ['user__username', 'full_name', 'email']
    readonly_fields = ['last_generated_at', 'generation_count', 'generation_date', 'created_at', 'updated_at']
