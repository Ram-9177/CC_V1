"""App config for the custom user model (AUTH_USER_MODEL)."""

from django.apps import AppConfig


class HostelconnectAuthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.hostelconnect_auth'
    label = 'hostelconnect_auth'
    verbose_name = 'HostelConnect authentication'
