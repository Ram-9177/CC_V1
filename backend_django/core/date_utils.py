"""Date parsing helpers shared across views."""

from datetime import date
from typing import Optional


def parse_iso_date_or_none(value: Optional[str]) -> Optional[date]:
    """Return ISO date if valid, else None."""
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def parse_iso_datetime_or_none(value: Optional[str]):
    """Return timezone-aware datetime if valid ISO, else None."""
    if not value:
        return None
    from django.utils import dateparse
    from django.utils import timezone
    dt = dateparse.parse_datetime(value)
    if dt and timezone.is_naive(dt):
        return timezone.make_aware(dt)
    return dt
