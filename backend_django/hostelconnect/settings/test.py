"""
Django settings for automated tests (pytest / CI).

Imports production base settings, then overrides cache, Channels, and Celery so the
suite does not require a running Redis instance. Runtime deployments continue to use
``hostelconnect.settings.base`` (Redis-backed cache, real Celery broker).

Set via: ``DJANGO_SETTINGS_MODULE=hostelconnect.settings.test`` (see ``pytest.ini``).
"""

from .base import *  # noqa: F401,F403

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "hc-pytest-locmem",
    }
}

CHANNEL_LAYERS = {
    "default": {"BACKEND": "channels.layers.InMemoryChannelLayer"},
}

CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
