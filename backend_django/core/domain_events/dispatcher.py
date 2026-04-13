"""
In-process domain event dispatcher (additive).

Subscribers must never raise into callers — failures are logged and skipped.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Callable

from core.domain_events.domain import DomainEvent

logger = logging.getLogger(__name__)

Handler = Callable[[DomainEvent, dict[str, Any]], None]

_subscribers: dict[DomainEvent, list[Handler]] = defaultdict(list)


def subscribe(event: DomainEvent, handler: Handler) -> None:
    """Register a handler for a domain event (idempotent per handler object)."""
    if handler not in _subscribers[event]:
        _subscribers[event].append(handler)


def unsubscribe(event: DomainEvent, handler: Handler) -> None:
    try:
        _subscribers[event].remove(handler)
    except ValueError:
        pass


def publish(event: DomainEvent, payload: dict[str, Any] | None = None) -> None:
    """
    Fan out to subscribers. Exceptions in handlers are isolated (main flow safe).
    """
    data = dict(payload or ())
    for fn in list(_subscribers.get(event, [])):
        try:
            fn(event, data)
        except Exception:
            logger.error(
                "domain_event_handler_failed event=%s handler=%s",
                event.value,
                getattr(fn, "__name__", repr(fn)),
                exc_info=True,
            )


def clear_subscribers() -> None:
    """Test helper / hot-reload safety."""
    _subscribers.clear()
