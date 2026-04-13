from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self) -> None:
        from core.domain_events import register_default_subscribers  # noqa: WPS433

        register_default_subscribers()
