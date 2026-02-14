"""App configuration for disciplinary module."""

from django.apps import AppConfig


class DisciplinaryConfig(AppConfig):
    """Configuration for the disciplinary app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.disciplinary'
    verbose_name = 'Disciplinary Actions'

    def ready(self):
        """Import signals when app is ready."""
        import apps.disciplinary.signals  # noqa: F401
