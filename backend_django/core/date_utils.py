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
