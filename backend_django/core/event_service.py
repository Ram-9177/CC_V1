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
import uuid

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
    tenant_id: str | int | None = None,
    trigger_user_id: str | int | None = None,
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
    # Standard envelope: legacy flat keys remain; nested ``data`` for new clients.
    payload = dict(data)
    enriched: dict[str, Any] = dict(payload)
    enriched["event"] = event_type
    if tenant_id is not None:
        enriched["tenant_id"] = str(tenant_id)
    if trigger_user_id is not None:
        enriched["user_id"] = str(trigger_user_id)
    enriched["data"] = dict(payload)

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
    tid = getattr(gate_pass, "college_id", None) or getattr(
        getattr(gate_pass, "college", None), "id", None
    )
    payload = {
        "id": gate_pass.id,
        "status": gate_pass.status,
        "movement_status": gate_pass.movement_status,
        "student_id": gate_pass.student_id,
        "resource": "gate_pass",
    }
    kw = {
        "user_id": gate_pass.student_id,
        "tenant_id": tid,
    }
    if on_commit:
        emit_event_on_commit(event_type, payload, **kw)
    else:
        emit_event(event_type, payload, **kw)


def emit_complaint_event(event_type: str, complaint, user_id: int | None = None) -> None:
    """Emit a complaint event with the canonical payload shape."""
    payload = {
        "id": complaint.id,
        "status": complaint.status,
        "severity": complaint.severity,
        "is_overdue": complaint.is_overdue,
        "resource": "complaint",
    }
    tid = getattr(complaint, "college_id", None)
    emit_event_on_commit(
        event_type,
        payload,
        user_id=user_id,
        tenant_id=str(tid) if tid is not None else None,
    )


def emit_user_event(event_type: str, user) -> None:
    """Emit a user change event (role change, activation, etc.)."""
    payload = {
        "id": user.id,
        "role": user.role,
        "is_active": user.is_active,
        "resource": "user",
    }
    emit_event_on_commit(event_type, payload, user_id=user.id)


class EventService:
    """Convenience class for Phase 6 event emission."""
    
    @staticmethod
    def emit(event_type: str, user, data: dict[str, Any]) -> None:
        """Centralized emission for Phase 6."""
        # Mix in base payload info if needed
        data.update({"resource": event_type.split('.')[0]})
        emit_event_on_commit(event_type, data, user_id=user.id if user else None)


def broadcast_event(event_type: str, payload: dict[str, Any]) -> bool:
    """Backward-compatible broadcast entrypoint used by core.tasks.

    Returns True on success, False if an exception was caught (behavior unchanged;
    callers may ignore the return value).
    """
    try:
        data = payload if isinstance(payload, dict) else {"payload": payload}

        user_id = data.get('user_id') or data.get('student_id')
        if user_id is not None:
            try:
                user_id = str(uuid.UUID(str(user_id)))
            except (TypeError, ValueError, AttributeError):
                user_id = str(user_id)

        role = data.get('role') if isinstance(data.get('role'), str) else None
        tenant_id = data.get('tenant_id')
        trigger_user_id = data.get('trigger_user_id')

        emit_event(
            event_type,
            data,
            user_id=user_id,
            role=role,
            to_management=True,
            tenant_id=tenant_id,
            trigger_user_id=trigger_user_id,
        )
        return True
    except Exception as exc:
        logger.warning("broadcast_event failed for %s: %s", event_type, exc)
        return False
