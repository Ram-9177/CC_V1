"""Default domain-event subscriptions (non-invasive; logging-only baseline)."""

from __future__ import annotations

import logging

from core.domain_events.dispatcher import publish, subscribe
from core.domain_events.domain import DomainEvent

logger = logging.getLogger(__name__)

_registered = False


def _log_domain_event(event: DomainEvent, payload: dict) -> None:
    logger.info(
        "domain_event_received %s keys=%s",
        event.value,
        list(payload.keys())[:12],
    )


def register_default_subscribers() -> None:
    """Idempotent registration of safe default handlers."""
    global _registered
    if _registered:
        return
    _registered = True
    for ev in (
        DomainEvent.GATE_PASS_APPROVED,
        DomainEvent.COMPLAINT_ESCALATED,
        DomainEvent.LEAVE_REJECTED,
    ):
        subscribe(ev, _log_domain_event)


def emit_domain_gate_pass_approved(payload: dict) -> None:
    """Convenience bridge from services (optional)."""
    publish(DomainEvent.GATE_PASS_APPROVED, payload)
