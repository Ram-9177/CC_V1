"""Gate Passes app configuration."""
from django.apps import AppConfig

class GatePassesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.gate_passes'

    def ready(self):
        import apps.gate_passes.signals
