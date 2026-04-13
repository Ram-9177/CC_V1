"""In-process domain event dispatcher (does not replace ``core.events.EVENTS`` WS registry)."""

from core.domain_events.domain import DomainEvent
from core.domain_events.dispatcher import publish, subscribe, unsubscribe
from core.domain_events.subscribers_default import register_default_subscribers

__all__ = [
    "DomainEvent",
    "publish",
    "subscribe",
    "unsubscribe",
    "register_default_subscribers",
]
