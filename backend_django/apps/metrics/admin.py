"""Metrics admin."""

from django.contrib import admin
from .models import Metric


@admin.register(Metric)
class MetricAdmin(admin.ModelAdmin):
    list_display = ['metric_type', 'value', 'timestamp']
    list_filter = ['metric_type', 'timestamp']
    readonly_fields = ['timestamp']
