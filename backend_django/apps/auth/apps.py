"""Authentication app configuration."""

from django.apps import AppConfig


class AuthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.auth'
    label = 'hostelconnect_auth'

    def ready(self):
        import apps.auth.signals
