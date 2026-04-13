"""
Domain-oriented event names (additive; does not replace dotted WS / outbox names).

Use with ``core.domain_events.dispatcher`` for in-process subscriptions.
"""

from __future__ import annotations

from enum import Enum


class DomainEvent(str, Enum):
    """PascalCase labels for documentation and dispatcher registration."""

    GATE_PASS_APPROVED = "GatePassApproved"
    COMPLAINT_ESCALATED = "ComplaintEscalated"
    LEAVE_REJECTED = "LeaveRejected"
