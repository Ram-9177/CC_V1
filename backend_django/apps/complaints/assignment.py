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
  Hostel Issue (room/elec/plum/clean) → Warden of the student's block
  Mess Issue → Chef / Head Chef
  Academic Issue → Faculty / HOD
  Admin Issue → Institutional Admin
  
SLA Escalation Flow:
  Staff (Warden/Chef/Faculty) → Head Warden / Admin → Super Admin

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
    Auto-assign a complaint based on Category-Role mapping.
    """
    from apps.auth.models import User
    from core.audit import log_action
    from core.event_service import emit_event_on_commit

    category = complaint.category
    assignee: Optional[User] = None
    college = complaint.college
    
    # ── Step 1: Route all categories to warden first (phase policy) ──────────
    try:
        building_id = _get_student_building_id(complaint.student)
        if building_id:
            assignee = _find_warden_for_building(building_id, college=college)
        if not assignee:
            assignee = _find_authority_in_college(['warden'], college=college)
        if not assignee:
            # Operational fallback if no warden exists in this college.
            assignee = _find_authority_in_college(['head_warden'], college=college)

    except Exception as lookup_err:
        logger.warning("[AutoAssign] Lookup failed for #%s: %s", complaint.id, lookup_err)

    # ── Step 2: Apply assignment ──────────────────────────────────────────────
    if assignee:
        complaint.assigned_to = assignee
        complaint.status = 'assigned' # Transition to assigned
        role_to_level = {
            'warden': 1,
            'head_warden': 2,
            'admin': 3,
        }
        inferred_level = role_to_level.get(getattr(assignee, 'role', None))
        if inferred_level is not None:
            complaint.escalation_level = max(int(getattr(complaint, 'escalation_level', 0) or 0), inferred_level)
        complaint.save(update_fields=["assigned_to", "status", "escalation_level", "updated_at"])

        log_action(actor or assignee, "UPDATE", complaint, 
                  changes={"assigned_to": [None, str(assignee.id)], "status": ['open', 'assigned']})

        emit_event_on_commit("complaint.assigned", {
            "id": str(complaint.id),
            "category": category,
            "title": complaint.title,
            "status": complaint.status,
            "assigned_to_id": str(assignee.id),
            "resource": "complaint",
        }, user_id=assignee.id)
        
        return True

    # Broadcast even if no specific user found
    emit_event_on_commit("complaint.created", {
        "id": str(complaint.id),
        "category": category,
        "status": complaint.status,
        "title": complaint.title,
        "resource": "complaint",
    }, to_management=True)

    return False


def get_escalation_target(complaint, next_level: Optional[int] = None) -> Optional["User"]:
    """
    Escalation Path (explicit):
      level 1 -> warden
      level 2 -> head_warden
      level 3 -> admin

    IMPORTANT: This function is side-effect free. It does not mutate complaint.
    """
    from core.constants import UserRoles

    college = complaint.college

    level = next_level if next_level is not None else (complaint.escalation_level + 1)
    if level <= 1:
        return _find_authority_in_college([UserRoles.WARDEN], college=college)
    if level == 2:
        return _find_authority_in_college([UserRoles.HEAD_WARDEN], college=college)
    if level == 3:
        return _find_authority_in_college([UserRoles.ADMIN], college=college)
    return None


def get_next_escalation_level(complaint) -> int:
    """
    Compute next escalation level with compatibility for legacy records.

    Some historical complaints were already assigned to warden/head_warden but
    still kept escalation_level=0. This helper prevents re-escalating to the
    same role tier by inferring the current level from assigned_to when needed.
    """
    from core.constants import UserRoles

    current_level = int(getattr(complaint, 'escalation_level', 0) or 0)
    if current_level > 0:
        return current_level + 1

    assigned_role = getattr(getattr(complaint, 'assigned_to', None), 'role', None)
    if assigned_role == UserRoles.WARDEN:
        return 2
    if assigned_role == UserRoles.HEAD_WARDEN:
        return 3
    return 1


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
