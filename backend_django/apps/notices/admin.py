"""Notices admin."""

from django.contrib import admin
from .models import Notice


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ['title', 'priority', 'author', 'is_published', 'published_date']
    list_filter = ['priority', 'is_published', 'target_audience', 'published_date']
    search_fields = ['title', 'content']
    readonly_fields = ['created_at', 'updated_at', 'published_date']
