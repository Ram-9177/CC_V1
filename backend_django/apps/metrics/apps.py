"""Metrics app configuration."""
from django.apps import AppConfig

class MetricsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.metrics'

    def ready(self):
        import apps.metrics.signals

