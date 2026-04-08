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

    # ── Phase 6: Events + Sports ──────────────────────────────────────────────
    "event.created": {
        "description": "Admin published a new institutional event",
        "groups": ["student", "management"],
        "resource": "event",
    },
    "event.registered": {
        "description": "Student registered for an event",
        "groups": ["user", "management"],
        "resource": "event",
    },
    "event.completed": {
        "description": "Event lifecycle finished",
        "groups": ["student", "management"],
        "resource": "event",
    },
    "booking.created": {
        "description": "Sports facility booked",
        "groups": ["user", "management", "pd"],
        "resource": "booking",
    },
    "match.started": {
        "description": "Competitive match started",
        "groups": ["student", "management", "pd"],
        "resource": "match",
    },
    "match.completed": {
        "description": "Competitive match finished",
        "groups": ["student", "management", "pd"],
        "resource": "match",
    },

    # ── Phase 7: Placements ───────────────────────────────────────────────────
    "job.created": {
        "description": "New job posting published",
        "groups": ["student", "management"],
        "resource": "job",
    },
    "application.submitted": {
        "description": "Student applied for a job",
        "groups": ["user", "management"],
        "resource": "application",
    },
    "application.shortlisted": {
        "description": "Student shortlisted for interview",
        "groups": ["user", "management"],
        "resource": "application",
    },
    "offer.released": {
        "description": "Offer letter issued to student",
        "groups": ["user", "management"],
        "resource": "offer",
    },
    "student.placed": {
        "description": "Student accepted offer and is officially placed",
        "groups": ["user", "management"],
        "resource": "placement",
    },

    # ── Phase 8: Alumni ───────────────────────────────────────────────────────
    "alumni.created": {
        "description": "Student successfully graduated and converted to alumni",
        "groups": ["user", "management"],
        "resource": "alumni",
    },
    "alumni.job.posted": {
        "description": "Alumni contributed a job posting",
        "groups": ["management"],
        "resource": "job",
    },
    "mentorship.requested": {
        "description": "Student requested mentorship from an alumni",
        "groups": ["user"],
        "resource": "mentorship",
    },
    "mentorship.accepted": {
        "description": "Alumni accepted a mentorship request",
        "groups": ["user"],
        "resource": "mentorship",
    },

    # ── Phase 9: System Operations ───────────────────────────────────────────
    "bulk.upload.started": {
        "description": "Large user dataset upload began",
        "groups": ["management"],
        "resource": "bulk_job",
    },
    "bulk.upload.completed": {
        "description": "Large user dataset upload finished processing",
        "groups": ["management"],
        "resource": "bulk_job",
    },
    "role.changed": {
        "description": "User authority level modified",
        "groups": ["user", "management"],
        "resource": "user_role",
    },
    "system.config.updated": {
        "description": "Global system behavior constant changed",
        "groups": ["management"],
        "resource": "system_config",
    },

    # ── Phase 10: Analytics & Automation ─────────────────────────────────────
    "analytics.updated": {
        "description": "Daily system pre-aggregation completed",
        "groups": ["management"],
        "resource": "analytics",
    },
    "alert.triggered": {
        "description": "Automation rule matched and executed",
        "groups": ["management"],
        "resource": "alert",
    },
    "rule.executed": {
        "description": "System automated action processed",
        "groups": ["management"],
        "resource": "automation_rule",
    },
}


def get_event_spec(event_type: str) -> Optional[EventSpec]:
    """Return the spec for a registered event type, or None."""
    return EVENTS.get(event_type)


class AppEvents:
    """Canonical event identifiers for type-safe emission."""
    EVENT_CREATED = "event.created"
    EVENT_REGISTERED = "event.registered"
    EVENT_COMPLETED = "event.completed"
    
    BOOKING_CREATED = "booking.created"
    MATCH_STARTED = "match.started"
    MATCH_COMPLETED = "match.completed"
    
    JOB_CREATED = "job.created"
    APPLICATION_SUBMITTED = "application.submitted"
    APPLICATION_SHORTLISTED = "application.shortlisted"
    OFFER_RELEASED = "offer.released"
    STUDENT_PLACED = "student.placed"
    
    ALUMNI_CREATED = "alumni.created"
    ALUMNI_JOB_POSTED = "alumni.job.posted"
    MENTORSHIP_REQUESTED = "mentorship.requested"
    MENTORSHIP_ACCEPTED = "mentorship.accepted"
    
    BULK_UPLOAD_STARTED = "bulk.upload.started"
    BULK_UPLOAD_COMPLETED = "bulk.upload.completed"
    ROLE_CHANGED = "role.changed"
    CONFIG_UPDATED = "system.config.updated"
    
    ANALYTICS_UPDATED = "analytics.updated"
    ALERT_TRIGGERED = "alert.triggered"
    RULE_EXECUTED = "rule.executed"
