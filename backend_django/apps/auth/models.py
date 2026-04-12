"""Re-export User from the AUTH_USER_MODEL app for backwards-compatible imports."""

from apps.hostelconnect_auth.models import User

__all__ = ('User',)
