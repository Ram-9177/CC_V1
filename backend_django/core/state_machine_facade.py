"""
Thin facade over core.state_machine for validation + structured logging.

Domain code should keep using the same transition tables; this module adds
a single extension point without duplicating rules.
"""

from __future__ import annotations

import logging
from typing import Any, Type

logger = logging.getLogger(__name__)


def validate_before_transition(
    machine_cls: Type[Any],
    current: str,
    requested: str,
) -> None:
    """Delegate to the machine's ``validate`` (same behavior as calling it directly)."""
    machine_cls.validate(current, requested)


def log_transition(
    module: str,
    resource: str,
    current: str,
    requested: str,
    *,
    trace_id: str | None = None,
) -> None:
    """Non-blocking INFO log for observability (does not alter transitions)."""
    logger.info(
        "state_transition %s %s %s -> %s",
        module,
        resource,
        current,
        requested,
        extra={
            "trace_id": trace_id or "-",
            "module": module,
            "resource": resource,
            "current_status": current,
            "requested_status": requested,
        },
    )


def can_transition(
    machine_cls: Type[Any],
    current: str,
    requested: str,
) -> bool:
    """Non-raising; uses the machine's ``can_transition`` when present."""
    fn = getattr(machine_cls, "can_transition", None)
    if callable(fn):
        return bool(fn(current, requested))
    transitions = getattr(machine_cls, "TRANSITIONS", None)
    if isinstance(transitions, dict):
        return requested in transitions.get(current, [])
    return False
