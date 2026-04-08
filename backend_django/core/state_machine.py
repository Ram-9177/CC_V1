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
        draft       → Saved but not yet submitted for approval
        pending     → Waiting for warden approval
        approved    → Warden has approved, student ready to exit
        rejected    → Warden rejected; terminal state
        out         → Student physically outside campus
        in          → Student physically returned to campus
        completed   → Pass finished its lifecycle; terminal
        expired     → Stale pass (was never used); terminal
        cancelled   → Cancelled by student or staff; terminal

    Terminal states (no further transitions):
        rejected, completed, expired, cancelled
    """

    TRANSITIONS: dict[str, list[str]] = {
        "draft":       ["pending", "cancelled"],
        "pending":     ["approved", "rejected", "cancelled"],
        "approved":    ["out",  "expired",  "cancelled"],
        "out":         ["in"],
        "in":          ["completed"],
        # Terminal states
        "completed":   [],
        "rejected":    [],
        "expired":     [],
        "cancelled":   [],
    }

    TERMINAL_STATES = {"completed", "rejected", "expired", "cancelled"}

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
        open         → Newly raised, awaiting assignment
        assigned     → Staff assigned, awaiting work start
        in_progress  → Staff working on issue
        resolved     → Issue fixed, student can verify
        closed       → Final state, no further action
        reopened     → Student rejected fix; back to in_progress
    """

    TRANSITIONS: dict[str, list[str]] = {
        "open":        ["assigned", "resolved", "closed", "invalid", "in_progress", "procurement"],
        "assigned":    ["in_progress", "procurement", "resolved", "open", "invalid"], 
        "in_progress": ["resolved", "assigned", "reopened", "invalid", "procurement"],
        "procurement": ["in_progress", "resolved", "closed", "invalid"],
        "resolved":    ["closed", "reopened", "in_progress", "invalid"],
        "closed":      ["reopened"],
        "reopened":    ["in_progress", "resolved", "assigned", "invalid", "procurement"],
        "invalid":     ["reopened"], # Allow reversing if mistake
    }

    TERMINAL_STATES = {"closed", "invalid"}

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
