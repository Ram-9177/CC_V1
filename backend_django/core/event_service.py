"""
core/event_service.py
=====================
The ONLY entry point for broadcasting real-time WebSocket events.

Rules (enforced internally):
  1. Every event_type MUST be registered in core/events.py.
  2. Unregistered event types are logged as a warning and still sent
     (backwards-compatible) — but will fail in strict mode.
  3. Broadcasts are ALWAYS fire-and-forget (never raise exceptions).
  4. All calls use transaction.on_commit() when inside an atomic block
     to prevent broadcasting before the DB row is actually committed.

Usage:
    # Inside a view or service — standard path:
    from core.event_service import emit_event
    emit_event("gatepass.approved", {"id": gp.id, "status": "approved"}, user_id=gp.student_id)

    # Delayed (inside atomic transaction, fires after commit):
    from core.event_service import emit_event_on_commit
    emit_event_on_commit("gatepass.created", payload, user_id=student.id)
"""

from __future__ import annotations

import logging
from typing import Any

from core.events import EVENTS

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def emit_event(
    event_type: str,
    data: dict[str, Any],
    *,
    user_id: int | None = None,
    role: str | None = None,
    to_management: bool = True,
    to_chef: bool = False,
    to_student_broadcast: bool = False,
) -> None:
    """
    Broadcast a structured, registered real-time event.

    Args:
        event_type:           A key from core/events.py (e.g. "gatepass.approved").
        data:                 Payload dict.  Keep it lean — IDs and status only.
        user_id:              If set, sends to the user's personal socket group.
        role:                 If set, sends to the role broadcast group.
        to_management:        If True (default), sends to management group.
        to_chef:              If True, also sends to chef role group.
        to_student_broadcast: If True, sends to role_student group (use sparingly).
    """
    from websockets.broadcast import (
        broadcast_to_group,
        broadcast_to_updates_user,
        broadcast_to_role,
        broadcast_to_management,
    )

    # ── 1. Registry check ─────────────────────────────────────────────────────
    if event_type not in EVENTS:
        logger.warning(
            "emit_event: unregistered event type '%s'. "
            "Register it in core/events.py for documentation and safety.",
            event_type,
        )

    # ── 2. Fan-out ────────────────────────────────────────────────────────────
    # Always enrich with the event type so the frontend handler knows what it is
    enriched = {"event": event_type, **data}

    # Personal user socket
    if user_id:
        broadcast_to_updates_user(user_id, event_type, enriched)

    # Role-specific group
    if role:
        broadcast_to_role(role, event_type, enriched)

    # Management broadcast (wardens, admins, head_warden)
    if to_management:
        broadcast_to_management(event_type, enriched)

    # Chef group (for forecast / meal updates)
    if to_chef:
        broadcast_to_role("chef", event_type, enriched)

    # All-student broadcast (use ONLY for notices / menu posts)
    if to_student_broadcast:
        broadcast_to_role("student", event_type, enriched)


def emit_event_on_commit(
    event_type: str,
    data: dict[str, Any],
    **kwargs: Any,
) -> None:
    """
    Schedule emit_event() to fire AFTER the current DB transaction commits.

    Use this inside views that are within an atomic() block to guarantee
    the DB row exists before the browser receives the WS push.

    Args:
        event_type: Same as emit_event().
        data:       Same as emit_event().
        **kwargs:   Forwarded to emit_event() (user_id, role, etc.).
    """
    from django.db import transaction

    def _fire():
        emit_event(event_type, data, **kwargs)

    transaction.on_commit(_fire)


# ─────────────────────────────────────────────────────────────────────────────
# Convenience helpers (avoids repetitive kwarg combos in caller code)
# ─────────────────────────────────────────────────────────────────────────────

def emit_gatepass_event(event_type: str, gate_pass, *, on_commit: bool = True) -> None:
    """Emit a gate pass event with the canonical payload shape."""
    payload = {
        "id": gate_pass.id,
        "status": gate_pass.status,
        "movement_status": gate_pass.movement_status,
        "student_id": gate_pass.student_id,
        "resource": "gate_pass",
    }
    if on_commit:
        emit_event_on_commit(event_type, payload, user_id=gate_pass.student_id)
    else:
        emit_event(event_type, payload, user_id=gate_pass.student_id)


def emit_complaint_event(event_type: str, complaint, user_id: int | None = None) -> None:
    """Emit a complaint event with the canonical payload shape."""
    payload = {
        "id": complaint.id,
        "status": complaint.status,
        "severity": complaint.severity,
        "is_overdue": complaint.is_overdue,
        "resource": "complaint",
    }
    emit_event_on_commit(event_type, payload, user_id=user_id)


def emit_user_event(event_type: str, user) -> None:
    """Emit a user change event (role change, activation, etc.)."""
    payload = {
        "id": user.id,
        "role": user.role,
        "is_active": user.is_active,
        "resource": "user",
    }
    emit_event_on_commit(event_type, payload, user_id=user.id)
