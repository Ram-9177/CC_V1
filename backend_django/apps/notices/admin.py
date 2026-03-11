"""Notices admin."""

from django.contrib import admin
from .models import Notice, NoticeLog


@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ['title', 'priority', 'author', 'is_published', 'published_date']
    list_filter = ['priority', 'is_published', 'target_audience', 'published_date']
    search_fields = ['title', 'content']
    readonly_fields = ['created_at', 'updated_at', 'published_date']


@admin.register(NoticeLog)
class NoticeLogAdmin(admin.ModelAdmin):
    list_display = ['notice', 'sender', 'target_role', 'users_notified_count', 'created_at']
    list_filter = ['target_role', 'created_at']
    search_fields = ['notice__title', 'sender__username']
    readonly_fields = ['created_at']
