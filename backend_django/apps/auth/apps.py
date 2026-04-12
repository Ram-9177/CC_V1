"""Authentication app configuration."""

from django.apps import AppConfig


class AuthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.auth'
    # Distinct from django.contrib.auth ('auth') and from apps.hostelconnect_auth ('hostelconnect_auth').
    label = 'hostelconnect_authentication'

    def ready(self):
        import apps.auth.signals
