"""
apps/complaints/assignment.py
=============================
Complaint Auto-Assignment Engine.

Determines WHO handles a complaint based on:
  1. Severity  → routes to correct role tier
  2. Building  → routes to the warden of that building
  3. Fallback  → head_warden if no matching warden found

Called by: ComplaintViewSet.perform_create()
           complaints/tasks.py (on SLA escalation)

Rules (reflect institutional approval hierarchy):
  critical / high  → assigned_to_role = head_warden (or nearest admin)
  medium / low     → assigned_to_role = warden of the student's block

Side effects:
  - Sets complaint.assigned_to (FK) if a matching User is found
  - Emits complaint.assigned WS event (via on_commit)
  - Logs the assignment to AuditLog
"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def auto_assign_complaint(complaint, actor=None) -> bool:
    """
    Auto-assign a complaint to the most appropriate staff member and
    notify them in real-time.

    Args:
        complaint: A saved Complaint instance.
        actor:     The user who triggered this (for audit trail). Optional.

    Returns:
        True if a specific User was assigned, False if only role-routing applied.
    """
    from apps.auth.models import User
    from core.constants import UserRoles
    from core.audit import log_action
    from core.event_service import emit_event_on_commit

    severity = complaint.severity
    assignee: Optional[User] = None

    # ── Step 1: Determine target role tier from severity ──────────────────────
    target_roles = UserRoles.get_complaint_targets(severity)
    # target_roles is e.g. ['head_warden', 'admin', 'super_admin'] or ['warden']

    # ── Step 2: Try to find domain-scoped assignee (same building / college) ──
    try:
        building_id = _get_student_building_id(complaint.student)

        if severity in ('medium', 'low') and building_id:
            # Find the warden assigned to this building
            assignee = _find_warden_for_building(building_id, college=complaint.college)

        if assignee is None:
            # Escalated path or no building-specific warden found
            # Find the head_warden or admin scoped to the same college
            assignee = _find_authority_in_college(
                target_roles,
                college=complaint.college
            )

    except Exception as lookup_err:
        logger.warning(
            "[AutoAssign] User lookup failed for complaint #%s: %s",
            complaint.id, lookup_err,
        )

    # ── Step 3: Apply assignment ──────────────────────────────────────────────
    did_assign = False

    if assignee and assignee != complaint.assigned_to:
        complaint.assigned_to = assignee
        complaint.save(update_fields=["assigned_to", "updated_at"])
        did_assign = True

        logger.info(
            "[AutoAssign] Complaint #%s (%s severity) auto-assigned to %s (%s).",
            complaint.id, severity, assignee.username, assignee.role,
        )

        # Audit trail
        log_action(
            actor or assignee,
            "UPDATE",
            complaint,
            changes={"assigned_to": [None, assignee.id]},
        )

        # Real-time: notify the newly assigned user
        emit_event_on_commit(
            "complaint.assigned",
            {
                "id": complaint.id,
                "severity": severity,
                "title": complaint.title,
                "status": complaint.status,
                "assigned_to_id": assignee.id,
                "resource": "complaint",
            },
            user_id=assignee.id,
        )

    # ── Step 4: Always broadcast to relevant role groups ─────────────────────
    # Even if we didn't find a specific user, broadcast to the role tier so
    # any online staff in that role sees the new complaint on their dashboard.
    emit_event_on_commit(
        "complaint.created",
        {
            "id": complaint.id,
            "severity": severity,
            "status": complaint.status,
            "title": complaint.title,
            "resource": "complaint",
        },
        to_management=True,
    )

    return did_assign


def get_escalation_target(complaint) -> Optional["User"]:
    """
    Return the next-up authority for escalation.

    Used by: escalate_overdue_complaints Celery task.

    Logic:
      - If currently assigned to a warden → escalate to head_warden
      - If currently assigned to head_warden → escalate to admin
      - Otherwise → return first available head_warden in college
    """
    from apps.auth.models import User
    from core.constants import UserRoles

    current_assignee = complaint.assigned_to
    college = complaint.college

    if current_assignee:
        weight = UserRoles.get_weight(current_assignee.role)

        if weight <= UserRoles.get_weight(UserRoles.WARDEN):
            # Was at warden level → escalate to head_warden
            target = _find_authority_in_college(
                [UserRoles.HEAD_WARDEN], college=college
            )
            return target

        if weight <= UserRoles.get_weight(UserRoles.HEAD_WARDEN):
            # Was at head_warden level → escalate to admin
            target = _find_authority_in_college(
                [UserRoles.ADMIN, UserRoles.SUPER_ADMIN], college=college
            )
            return target

    # No specific assignee — find any head_warden in college
    return _find_authority_in_college(
        [UserRoles.HEAD_WARDEN, UserRoles.ADMIN], college=college
    )


# ─────────────────────────────────────────────────────────────────────────────
# Private helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_student_building_id(student) -> Optional[int]:
    """Return the building ID of the student's current room allocation."""
    from apps.rooms.models import RoomAllocation
    alloc = (
        RoomAllocation.objects
        .filter(student=student, end_date__isnull=True)
        .select_related("room__building")
        .first()
    )
    if alloc and alloc.room and alloc.room.building_id:
        return alloc.room.building_id
    return None


def _find_warden_for_building(building_id: int, college=None):
    """
    Find a warden whose assigned_blocks include this building.
    College-scoped if provided.
    """
    from apps.auth.models import User
    qs = (
        User.objects
        .filter(
            role="warden",
            is_active=True,
            assigned_blocks=building_id,
        )
        .order_by("id")
    )
    if college:
        qs = qs.filter(college=college)
    return qs.first()


def _find_authority_in_college(roles: list, college=None):
    """
    Find the first active user matching any of the given roles,
    scoped to the given college if provided.

    Roles are tried in list order so the first match is the most preferred.
    """
    from apps.auth.models import User
    for role in roles:
        qs = User.objects.filter(role=role, is_active=True).order_by("id")
        if college:
            qs = qs.filter(college=college)
        user = qs.first()
        if user:
            return user
    return None
