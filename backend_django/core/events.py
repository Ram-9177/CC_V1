"""
core/events.py
==============
Centralized event registry — single source of truth for every
real-time event emitted in CampusCore.

Usage:
    from core.event_service import emit_event
    emit_event("gatepass.approved", {"id": gp.id}, user_id=gp.student_id)

DO NOT call broadcast_to_group() directly from views.
All broadcast calls MUST go through emit_event().
"""

from typing import TypedDict, List, Optional


class EventSpec(TypedDict, total=False):
    description: str
    groups: List[str]       # logical targets: "user", "management", "security", "warden", "chef", "student"
    resource: str           # the resource type this event is about


# ─────────────────────────────────────────────────────────────────────────────
# Event Registry
# ─────────────────────────────────────────────────────────────────────────────
# Key format: "<resource>.<action>"
# groups logic is enforced in emit_event() in event_service.py

EVENTS: dict[str, EventSpec] = {

    # ── Gate Pass ─────────────────────────────────────────────────────────────
    "gatepass.created": {
        "description": "Student submitted a new gate pass request",
        "groups": ["user", "management"],
        "resource": "gate_pass",
    },
    "gatepass.approved": {
        "description": "Warden approved the gate pass",
        "groups": ["user", "management", "security"],
        "resource": "gate_pass",
    },
    "gatepass.rejected": {
        "description": "Warden rejected the gate pass",
        "groups": ["user", "management"],
        "resource": "gate_pass",
    },
    "gatepass.exited": {
        "description": "Security marked student as exited",
        "groups": ["user", "management"],
        "resource": "gate_pass",
    },
    "gatepass.returned": {
        "description": "Security marked student as returned",
        "groups": ["user", "management"],
        "resource": "gate_pass",
    },
    "gatepass.late_return": {
        "description": "Student returned late — warden + security notified",
        "groups": ["user", "management", "warden"],
        "resource": "gate_pass",
    },
    "gatepass.expired": {
        "description": "Celery auto-expired stale gate pass",
        "groups": ["user", "management"],
        "resource": "gate_pass",
    },
    "gatepass.cancelled": {
        "description": "Student or staff cancelled the gate pass",
        "groups": ["user", "management"],
        "resource": "gate_pass",
    },

    # ── Complaints ────────────────────────────────────────────────────────────
    "complaint.created": {
        "description": "Student raised a new complaint",
        "groups": ["warden", "management"],
        "resource": "complaint",
    },
    "complaint.assigned": {
        "description": "Complaint assigned to a staff member",
        "groups": ["user", "management"],
        "resource": "complaint",
    },
    "complaint.resolved": {
        "description": "Complaint marked as resolved",
        "groups": ["user", "management"],
        "resource": "complaint",
    },
    "complaint.escalated": {
        "description": "Complaint SLA breach — escalated to head_warden",
        "groups": ["management"],
        "resource": "complaint",
    },
    "complaint.sla_breach": {
        "description": "Complaint SLA timer has expired (Celery detected)",
        "groups": ["management", "warden"],
        "resource": "complaint",
    },

    # ── Attendance ────────────────────────────────────────────────────────────
    "attendance.marked": {
        "description": "Attendance record updated for a student",
        "groups": ["user", "management"],
        "resource": "attendance",
    },
    "attendance.bulk_marked": {
        "description": "Bulk attendance submitted for a block/floor",
        "groups": ["management"],
        "resource": "attendance",
    },

    # ── Rooms ─────────────────────────────────────────────────────────────────
    "room.allocated": {
        "description": "Student has been allocated to a room/bed",
        "groups": ["user", "management"],
        "resource": "room",
    },
    "room.deallocated": {
        "description": "Student's room allocation was removed",
        "groups": ["user", "management"],
        "resource": "room",
    },

    # ── Meals / Forecast ──────────────────────────────────────────────────────
    "meal.menu_posted": {
        "description": "Chef published the day's menu",
        "groups": ["student", "management"],
        "resource": "meal",
    },
    "meal.forecast_updated": {
        "description": "Dining forecast recalculated (gate pass / attendance change)",
        "groups": ["chef", "management"],
        "resource": "forecast",
    },

    # ── Notifications ─────────────────────────────────────────────────────────
    "notification.new": {
        "description": "A new in-app notification created for a user",
        "groups": ["user"],
        "resource": "notification",
    },
    "notification.unread_delta": {
        "description": "Unread badge count delta (avoids DB fetch)",
        "groups": ["user"],
        "resource": "notification",
    },

    # ── User / Auth ───────────────────────────────────────────────────────────
    "user.role_changed": {
        "description": "Admin changed a user's role — forces instant re-auth on target",
        "groups": ["user", "management"],
        "resource": "user",
    },
    "user.activated": {
        "description": "Admin activated a user account",
        "groups": ["user", "management"],
        "resource": "user",
    },
    "user.deactivated": {
        "description": "Admin deactivated a user account",
        "groups": ["user", "management"],
        "resource": "user",
    },
    "user.profile_updated": {
        "description": "User profile or photo updated",
        "groups": ["user"],
        "resource": "user",
    },

    # ── Leaves ────────────────────────────────────────────────────────────────
    "leave.applied": {
        "description": "Student submitted a leave application",
        "groups": ["management", "warden"],
        "resource": "leave",
    },
    "leave.approved": {
        "description": "Warden approved student leave",
        "groups": ["user", "management"],
        "resource": "leave",
    },
    "leave.rejected": {
        "description": "Warden rejected student leave",
        "groups": ["user"],
        "resource": "leave",
    },

    # ── Notices ───────────────────────────────────────────────────────────────
    "notice.published": {
        "description": "New notice published to targeted audience",
        "groups": ["student", "management"],
        "resource": "notice",
    },

    # ── Student Type System ────────────────────────────────────────────────────
    "student.type_changed": {
        "description": "Student type changed between hosteller and day_scholar",
        "groups": ["user", "management"],
        "resource": "user",
    },
    "student.type_change_requested": {
        "description": "Warden initiated a student type change request",
        "groups": ["management"],
        "resource": "user",
    },
    "student.type_change_approved": {
        "description": "Head Warden approved a student type change request",
        "groups": ["user", "management"],
        "resource": "user",
    },
    "student.type_change_rejected": {
        "description": "Head Warden rejected a student type change request",
        "groups": ["user", "management"],
        "resource": "user",
    },
}


def get_event_spec(event_type: str) -> Optional[EventSpec]:
    """Return the spec for a registered event type, or None."""
    return EVENTS.get(event_type)
