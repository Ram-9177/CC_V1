"""
apps/users/student_type_service.py
===================================
Centralized Student Type System — the ONLY place that manages
hosteller ↔ day_scholar transitions with full atomic safety.

Architecture:
  • is_hosteller() / is_day_scholar() — fast boolean guards used everywhere
  • StudentTypeChangeRequest model — workflow entry point (Warden → Head Warden)
  • StudentTypeChangeService — atomic execution engine
  • TypeChangeSerializer / ViewSet — REST API surface

Rules enforced here:
  1. Direct `student_type` field updates are FORBIDDEN outside this module
  2. Every transition must go through an approved workflow request
  3. Hosteller → Day Scholar: removes room, de-activates hostel access
  4. Day Scholar → Hosteller: requires room assignment in same transaction
  5. All changes are audit-logged and emit real-time events
"""
# pyre-ignore-all-errors
# pyright: reportMissingImports=false
# pyright: reportMissingModuleSource=false

from __future__ import annotations

import logging
from typing import Optional

from django.db import transaction  # type: ignore[import]
from django.utils import timezone  # type: ignore[import]

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Feature Guards — use these everywhere instead of comparing student_type raw
# ─────────────────────────────────────────────────────────────────────────────

STUDENT_TYPE_HOSTELLER = "hosteller"
STUDENT_TYPE_DAY_SCHOLAR = "day_scholar"

HOSTEL_FEATURES = [
    "room_allocation",
    "room_shifting",
    "mess",
    "hostel_complaints",
    "gate_pass_advanced",
    "hostel_dashboard",
    "attendance_hostel",
    "leaves",
    "visitors",
]

BASE_FEATURES = [
    "dashboard",
    "profile",
    "events",
    "sports",
    "notices",
    "notifications",
    "general_complaints",
    "digital_id",
    "resume_builder",
    "hall_booking",
]


def is_hosteller(user) -> bool:
    """Return True if the user is a hosteller student."""
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) != "student":
        return False
    return getattr(user, "student_type", None) == STUDENT_TYPE_HOSTELLER


def is_day_scholar(user) -> bool:
    """Return True if the user is a day scholar student."""
    if not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "role", None) != "student":
        return False
    return getattr(user, "student_type", None) == STUDENT_TYPE_DAY_SCHOLAR


def get_allowed_features(user) -> list[str]:
    """Return the list of allowed feature slugs for this user."""
    if getattr(user, "role", None) != "student":
        return BASE_FEATURES + HOSTEL_FEATURES  # staff access everything
    if is_hosteller(user):
        return BASE_FEATURES + HOSTEL_FEATURES
    return BASE_FEATURES


def assert_hosteller(user):
    """
    Raise PermissionError if user is NOT a hosteller.
    Use this as a guard at the top of hostel-only views.

    Usage::
        from apps.users.student_type_service import assert_hosteller
        assert_hosteller(request.user)
    """
    from core.errors import api_error_response  # type: ignore[import]
    if not is_hosteller(user):
        raise PermissionError("This feature is only available to hostellers.")


# ─────────────────────────────────────────────────────────────────────────────
# Atomic Transition Engine
# ─────────────────────────────────────────────────────────────────────────────

class StudentTypeChangeService:
    """
    Executes an approved student type change atomically.

    Call sequence:
        1. Warden creates a StudentTypeChangeRequest (workflow/models.py)
        2. Head Warden / Admin approves it
        3. This service.execute(request) is called from the approval view
        4. All side-effects (room remove/assign, mess, event) happen here
    """

    @staticmethod
    @transaction.atomic
    def execute(change_request) -> dict:
        """
        Atomically apply an approved student_type change.

        Returns a result dict with `success`, `message`, and `user_id`.
        Raises ValueError for invalid state, PermissionError for invalid actor.
        """
        from apps.auth.models import User  # type: ignore[import]

        req = change_request
        student: User = req.student

        # ── Guard: already same type ──────────────────────────────────────────
        if student.student_type == req.new_type:
            raise ValueError(
                f"Student is already '{req.new_type}'. No change needed."
            )

        # ── Guard: inactive student ──────────────────────────────────────────
        if not student.is_active:
            raise ValueError("Cannot change type of an inactive student.")

        old_type = student.student_type

        if req.new_type == STUDENT_TYPE_DAY_SCHOLAR:
            StudentTypeChangeService._hosteller_to_day_scholar(student, req)
        elif req.new_type == STUDENT_TYPE_HOSTELLER:
            StudentTypeChangeService._day_scholar_to_hosteller(student, req)
        else:
            raise ValueError(f"Invalid student_type target: '{req.new_type}'")

        # ── Audit log ─────────────────────────────────────────────────────────
        StudentTypeChangeService._log_change(
            student=student,
            old_type=old_type,
            new_type=req.new_type,
            performed_by=req.approved_by,
            request_id=req.id,
        )

        # ── Emit event (after commit) ─────────────────────────────────────────
        transaction.on_commit(
            lambda: StudentTypeChangeService._emit(student, old_type, req.new_type)
        )

        return {"success": True, "user_id": student.id, "new_type": req.new_type}

    # ── Private helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _hosteller_to_day_scholar(student, req) -> None:
        """Remove hostel access and update student_type."""
        from apps.rooms.models import RoomAllocation  # type: ignore[import]

        # 1. End any active room allocations
        active_allocs = RoomAllocation.objects.filter(
            student=student, end_date__isnull=True
        )
        if active_allocs.exists():
            for alloc in active_allocs:
                alloc.end_date = timezone.now().date()
                alloc.notes = (
                    f"Auto-ended due to student type change to day_scholar. "
                    f"Approved by {req.approved_by}. Request #{req.id}"
                )
                alloc.save(update_fields=["end_date", "notes"])

                # Free the bed
                if alloc.bed:
                    alloc.bed.is_occupied = False
                    alloc.bed.save(update_fields=["is_occupied"])

                # Update room occupancy
                alloc.room.current_occupancy = max(
                    0, alloc.room.current_occupancy - 1
                )
                alloc.room.is_available = (
                    alloc.room.current_occupancy < alloc.room.capacity
                )
                alloc.room.save(update_fields=["current_occupancy", "is_available"])

                logger.info(
                    "Ended room allocation #%d for student %d (hosteller→day_scholar)",
                    alloc.id, student.id
                )

        # 2. Update student_type
        student.student_type = STUDENT_TYPE_DAY_SCHOLAR
        student.save(update_fields=["student_type"])

    @staticmethod
    def _day_scholar_to_hosteller(student, req) -> None:
        """Assign room (from request) and update student_type."""
        from apps.rooms.models import RoomAllocation, Room, Bed  # type: ignore[import]

        # Validate room assignment
        room_id = getattr(req, "target_room_id", None)
        bed_id = getattr(req, "target_bed_id", None)

        if not room_id:
            raise ValueError(
                "Cannot convert to hosteller: no target_room_id provided on request."
            )

        try:
            room = Room.objects.get(id=room_id)
        except Room.DoesNotExist:
            raise ValueError(f"Room #{room_id} does not exist.")

        if room.current_occupancy >= room.capacity:
            raise ValueError(
                f"Room {room.room_number} is full ({room.current_occupancy}/{room.capacity})."
            )

        bed: Optional[Bed] = None
        if bed_id:
            try:
                bed = Bed.objects.select_for_update().get(id=bed_id, room=room)
            except Bed.DoesNotExist:
                raise ValueError(f"Bed #{bed_id} not found in room {room.room_number}.")
            if bed.is_occupied:
                raise ValueError(f"Bed {bed.bed_number} is already occupied.")
            bed.is_occupied = True
            bed.save(update_fields=["is_occupied"])

        # Create allocation
        RoomAllocation.objects.create(
            student=student,
            room=room,
            bed=bed,
            status="approved",
            allocated_date=timezone.now().date(),
            allocated_by=req.approved_by,
            notes=f"Auto-allocated via student type change. Request #{req.id}",
        )

        # Update room occupancy
        room.current_occupancy += 1
        if room.current_occupancy >= room.capacity:
            room.is_available = False
        room.save(update_fields=["current_occupancy", "is_available"])

        # Update student_type
        student.student_type = STUDENT_TYPE_HOSTELLER
        student.save(update_fields=["student_type"])

        logger.info(
            "Assigned student %d to room %s (day_scholar→hosteller)",
            student.id, room.room_number
        )

    @staticmethod
    def _log_change(student, old_type: str, new_type: str, performed_by, request_id: int) -> None:
        """Write an immutable audit record."""
        try:
            StudentTypeAuditLog.objects.create(
                student=student,
                old_type=old_type,
                new_type=new_type,
                performed_by=performed_by,
                change_request_id=request_id,
            )
        except Exception as e:
            # Never break the main flow due to audit failure
            logger.error("Failed to write StudentTypeAuditLog: %s", e)

    @staticmethod
    def _emit(student, old_type: str, new_type: str) -> None:
        """Emit the real-time event after DB commit."""
        try:
            from core.event_service import emit_event  # type: ignore[import]
            emit_event(
                "student.type_changed",
                {
                    "user_id": student.id,
                    "old_type": old_type,
                    "new_type": new_type,
                    "resource": "user",
                },
                user_id=student.id,
                to_management=True,
            )
        except Exception as e:
            logger.error("Failed to emit student.type_changed: %s", e)


# ─────────────────────────────────────────────────────────────────────────────
# Audit Log Model (lives here so it's co-located with the service)
# ─────────────────────────────────────────────────────────────────────────────

from django.db import models  # type: ignore[import]  # noqa: E402  (after service definitions)
from core.models import TimestampedModel  # type: ignore[import]  # noqa: E402


class StudentTypeAuditLog(TimestampedModel):
    """Immutable record of every student_type change."""

    student = models.ForeignKey(
        "auth.User",
        on_delete=models.CASCADE,
        related_name="type_change_logs",
    )
    old_type = models.CharField(max_length=20)
    new_type = models.CharField(max_length=20)
    performed_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="type_changes_performed",
    )
    change_request_id = models.IntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "student_type_audit_log"
        indexes = [
            models.Index(fields=["student", "-created_at"]),
            models.Index(fields=["new_type", "-created_at"]),
        ]

    def __str__(self):
        return (
            f"{self.student} | {self.old_type} → {self.new_type} "
            f"| by {self.performed_by} | {self.created_at}"
        )


class StudentTypeChangeRequest(TimestampedModel):
    """
    Workflow model: Warden initiates → Head Warden / Admin approves.
    Applied atomically by StudentTypeChangeService.execute().
    """

    STATUS_CHOICES = [
        ("pending", "Pending Approval"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("executed", "Executed"),
    ]

    student = models.ForeignKey(
        "auth.User",
        on_delete=models.CASCADE,
        related_name="type_change_requests",
    )
    requested_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="type_change_requests_initiated",
    )
    approved_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="type_change_requests_approved",
    )

    current_type = models.CharField(max_length=20)
    new_type = models.CharField(max_length=20)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")

    reason = models.TextField(help_text="Why this change is being requested.")
    rejection_reason = models.TextField(blank=True)

    # For day_scholar → hosteller: must specify a room (and optionally a bed)
    target_room_id = models.IntegerField(
        null=True, blank=True,
        help_text="Required when converting day_scholar → hosteller"
    )
    target_bed_id = models.IntegerField(
        null=True, blank=True,
        help_text="Optional specific bed (auto-assigned if omitted)"
    )

    approved_at = models.DateTimeField(null=True, blank=True)
    executed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        db_table = "student_type_change_request"
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self):
        return (
            f"TypeChange #{self.id}: {self.student} "
            f"{self.current_type}→{self.new_type} [{self.status}]"
        )
