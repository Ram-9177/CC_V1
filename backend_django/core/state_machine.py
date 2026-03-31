"""
core/state_machine.py
=====================
Centralized state machine for all stateful models in CampusCore.

Usage:
    from core.state_machine import validate_transition, GatePassMachine, ComplaintMachine

    # Raises InvalidTransitionError if the move is illegal
    GatePassMachine.validate("pending", "approved")

    # Functional form — same effect
    validate_transition("pending", "approved", GatePassMachine.TRANSITIONS)

Design decisions:
  - One class per resource — easy to find, easy to extend.
  - `validate()` raises InvalidTransitionError (a subclass of DRF ValidationError)
    so callers don't need try/except — DRF already handles it cleanly.
  - Classes are stateless — just constant dicts with helper methods.
  - Adding a new state = add it to TRANSITIONS. No other changes needed.
"""

from __future__ import annotations

from rest_framework.exceptions import ValidationError


class InvalidTransitionError(ValidationError):
    """Raised when a model's status would move to an illegal state."""

    def __init__(self, current: str, requested: str, resource: str = "record"):
        super().__init__(
            detail={
                "message": (
                    f"Cannot move {resource} from '{current}' to '{requested}'. "
                    f"This transition is not allowed."
                ),
                "error_code": "INVALID_STATE_TRANSITION",
                "current_status": current,
                "requested_status": requested,
            }
        )


# ─────────────────────────────────────────────────────────────────────────────
# Gate Pass State Machine
# ─────────────────────────────────────────────────────────────────────────────

class GatePassMachine:
    """
    Defines valid gate pass status transitions.

    States:
        pending     → Waiting for warden approval
        approved    → Warden has approved, student has not exited yet
        rejected    → Warden rejected; terminal state
        outside     → Student scanned out / physically outside campus
        returned    → Student scanned back in on time; terminal state
        late_return → Student returned but past expected entry time; terminal state
        expired     → Celery auto-expired stale pass; terminal state
        cancelled   → Student or staff cancelled; terminal state

    Terminal states (no further transitions):
        rejected, returned, late_return, expired, cancelled
    """

    TRANSITIONS: dict[str, list[str]] = {
        "pending":     ["approved", "rejected", "cancelled"],
        "approved":    ["outside",  "expired",  "cancelled"],
        "outside":     ["returned", "late_return"],
        # Terminal states — nothing can follow
        "returned":    [],
        "late_return": [],
        "rejected":    [],
        "expired":     [],
        "cancelled":   [],
    }

    TERMINAL_STATES = {"returned", "late_return", "rejected", "expired", "cancelled"}

    @classmethod
    def validate(cls, current: str, requested: str) -> None:
        """
        Assert that moving from `current` → `requested` is legal.

        Raises:
            InvalidTransitionError: if the transition is not in TRANSITIONS.
        """
        allowed = cls.TRANSITIONS.get(current, [])
        if requested not in allowed:
            raise InvalidTransitionError(current, requested, resource="gate pass")

    @classmethod
    def is_terminal(cls, status: str) -> bool:
        """Return True if this status allows no further transitions."""
        return status in cls.TERMINAL_STATES

    @classmethod
    def can_transition(cls, current: str, requested: str) -> bool:
        """Non-raising version — returns True/False."""
        return requested in cls.TRANSITIONS.get(current, [])


# ─────────────────────────────────────────────────────────────────────────────
# Complaint State Machine
# ─────────────────────────────────────────────────────────────────────────────

class ComplaintMachine:
    """
    Defines valid complaint status transitions.

    States:
        open         → Newly raised, not yet assigned / in progress
        in_progress  → Assigned to staff, being worked on
        resolved     → Issue fixed; terminal state
    """

    TRANSITIONS: dict[str, list[str]] = {
        "open":        ["in_progress", "resolved"],
        "in_progress": ["resolved", "open"],   # Can reopen if fix didn't hold
        "resolved":    [],                      # Terminal
    }

    TERMINAL_STATES = {"resolved"}

    @classmethod
    def validate(cls, current: str, requested: str) -> None:
        allowed = cls.TRANSITIONS.get(current, [])
        if requested not in allowed:
            raise InvalidTransitionError(current, requested, resource="complaint")

    @classmethod
    def can_transition(cls, current: str, requested: str) -> bool:
        return requested in cls.TRANSITIONS.get(current, [])


# ─────────────────────────────────────────────────────────────────────────────
# Leave Application State Machine
# ─────────────────────────────────────────────────────────────────────────────

class LeaveMachine:
    """
    Defines valid leave application transitions.

    States:
        PENDING_APPROVAL → Just submitted
        APPROVED         → Warden approved
        ACTIVE           → Leave period has started (student is out)
        COMPLETED        → Student returned, leave closed
        REJECTED         → Terminal
        CANCELLED        → Cancelled by student or staff; terminal
    """

    TRANSITIONS: dict[str, list[str]] = {
        "PENDING_APPROVAL": ["APPROVED", "REJECTED", "CANCELLED"],
        "APPROVED":         ["ACTIVE",   "CANCELLED"],
        "ACTIVE":           ["COMPLETED"],
        "COMPLETED":        [],
        "REJECTED":         [],
        "CANCELLED":        [],
    }

    TERMINAL_STATES = {"COMPLETED", "REJECTED", "CANCELLED"}

    @classmethod
    def validate(cls, current: str, requested: str) -> None:
        allowed = cls.TRANSITIONS.get(current, [])
        if requested not in allowed:
            raise InvalidTransitionError(current, requested, resource="leave application")

    @classmethod
    def can_transition(cls, current: str, requested: str) -> bool:
        return requested in cls.TRANSITIONS.get(current, [])


# ─────────────────────────────────────────────────────────────────────────────
# Generic functional helper
# ─────────────────────────────────────────────────────────────────────────────

def validate_transition(
    current: str,
    requested: str,
    transitions: dict[str, list[str]],
    resource: str = "record",
) -> None:
    """
    Generic transition validator for any resource.

    Args:
        current:     Current status string.
        requested:   Desired next status.
        transitions: The TRANSITIONS dict from a Machine class.
        resource:    Human-readable name for error messages.

    Raises:
        InvalidTransitionError: If the transition is not allowed.
    """
    allowed = transitions.get(current, [])
    if requested not in allowed:
        raise InvalidTransitionError(current, requested, resource=resource)
