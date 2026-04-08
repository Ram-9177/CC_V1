"""
apps/users/student_type_views.py
==================================
REST API surface for the Student Type workflow system.

Endpoints:
  POST   /api/student-type/requests/           — Warden initiates a request
  GET    /api/student-type/requests/           — List all requests (management)
  GET    /api/student-type/requests/{id}/      — Retrieve a specific request
  POST   /api/student-type/requests/{id}/approve/  — Head Warden approves
  POST   /api/student-type/requests/{id}/reject/   — Head Warden rejects
  GET    /api/student-type/audit/              — Audit log (admin only)
  GET    /api/student-type/status/             — Current user's student type
  GET    /api/student-type/features/           — Current user's feature list
"""
# pyre-ignore-all-errors
# pyright: reportMissingImports=false

from rest_framework import viewsets, status  # type: ignore[import]
from rest_framework.decorators import action  # type: ignore[import]
from rest_framework.response import Response  # type: ignore[import]
from rest_framework.permissions import IsAuthenticated  # type: ignore[import]
from rest_framework.views import APIView  # type: ignore[import]
from django.utils import timezone  # type: ignore[import]
from django.db import transaction  # type: ignore[import]

from core.permissions import (  # type: ignore[import]
    IsWarden, IsAdmin, user_is_admin, user_is_warden, user_is_staff,
    ROLE_HEAD_WARDEN, ROLE_ADMIN, ROLE_SUPER_ADMIN,
)
from core.errors import api_error_response  # type: ignore[import]

from .student_type_service import (
    StudentTypeChangeRequest,
    StudentTypeAuditLog,
    StudentTypeChangeService,
    get_allowed_features,
    is_hosteller,
    is_day_scholar,
    STUDENT_TYPE_HOSTELLER,
    STUDENT_TYPE_DAY_SCHOLAR,
)
from .student_type_serializers import (
    StudentTypeChangeRequestSerializer,
    StudentTypeChangeRequestCreateSerializer,
    StudentTypeAuditLogSerializer,
)

import logging
logger = logging.getLogger(__name__)


class StudentTypeStatusView(APIView):
    """
    GET /api/student-type/status/
    Returns the current user's student_type and allowed features.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            "student_type": getattr(user, "student_type", None),
            "is_hosteller": is_hosteller(user),
            "is_day_scholar": is_day_scholar(user),
            "features": get_allowed_features(user),
        })


class StudentTypeChangeRequestViewSet(viewsets.ModelViewSet):
    """
    CRUD + workflow actions for StudentTypeChangeRequest.
    Initiators: Wardens / Admins
    Approvers: Head Warden / Admin / Super Admin
    """
    queryset = StudentTypeChangeRequest.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = StudentTypeChangeRequestSerializer

    def get_queryset(self):
        user = self.request.user
        qs = StudentTypeChangeRequest.objects.select_related(
            "student", "requested_by", "approved_by"
        )

        # Multi-tenant safety: scope by college
        college_id = getattr(user, "college_id", None)
        if college_id and not getattr(user, "is_superuser", False):
            qs = qs.filter(student__college_id=college_id)

        # Students can see only their own requests
        if getattr(user, "role", None) == "student":
            qs = qs.filter(student=user)

        return qs.order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return StudentTypeChangeRequestCreateSerializer
        return StudentTypeChangeRequestSerializer

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated(), (IsWarden | IsAdmin)()]
        if self.action in ["approve", "reject"]:
            return [IsAuthenticated()]  # further checked in the action
        return [IsAuthenticated()]

    def create(self, request, *args, **kwargs):
        """Warden / Admin initiates a type change request."""
        user = request.user
        if not (user_is_warden(user) or user_is_admin(user)):
            return api_error_response(
                "Only wardens and admins can initiate type change requests.",
                "PERMISSION_DENIED", 403
            )

        serializer = StudentTypeChangeRequestCreateSerializer(
            data=request.data,
            context={"request": request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        student = serializer.validated_data["student"]
        new_type = serializer.validated_data["new_type"]

        # Guard: check no duplicate pending request
        existing = StudentTypeChangeRequest.objects.filter(
            student=student, status="pending"
        ).exists()
        if existing:
            return api_error_response(
                "A pending type change request for this student already exists.",
                "DUPLICATE_REQUEST", 409
            )

        # Guard: check no same-type request
        if student.student_type == new_type:
            return api_error_response(
                f"Student is already '{new_type}'.",
                "NO_CHANGE_NEEDED", 400
            )

        change_req = serializer.save(
            requested_by=user,
            current_type=student.student_type,
            status="pending",
        )

        return Response(
            StudentTypeChangeRequestSerializer(change_req).data,
            status=201
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        """Head Warden / Admin approves the request and executes the change."""
        user = request.user
        if getattr(user, "role", None) not in [
            ROLE_HEAD_WARDEN, ROLE_ADMIN, ROLE_SUPER_ADMIN
        ]:
            return api_error_response(
                "Only Head Warden / Admin can approve type change requests.",
                "PERMISSION_DENIED", 403
            )

        try:
            change_req = self.get_queryset().get(pk=pk)
        except StudentTypeChangeRequest.DoesNotExist:
            return api_error_response("Request not found.", "NOT_FOUND", 404)

        if change_req.status != "pending":
            return api_error_response(
                f"Request is already '{change_req.status}'. Cannot approve.",
                "INVALID_STATUS", 400
            )

        # Mark as approved before execution
        change_req.approved_by = user
        change_req.approved_at = timezone.now()
        change_req.status = "approved"
        change_req.save(update_fields=["approved_by", "approved_at", "status"])

        try:
            result = StudentTypeChangeService.execute(change_req)
        except (ValueError, PermissionError) as e:
            # Roll back approval status on failure
            change_req.status = "pending"
            change_req.approved_by = None
            change_req.approved_at = None
            change_req.save(update_fields=["status", "approved_by", "approved_at"])
            return api_error_response(str(e), "EXECUTION_FAILED", 400)
        except Exception as e:
            logger.exception("Unexpected error executing type change #%s: %s", pk, e)
            change_req.status = "pending"
            change_req.save(update_fields=["status"])
            return api_error_response(
                "An unexpected error occurred. No changes were made.",
                "SERVER_ERROR", 500
            )

        change_req.status = "executed"
        change_req.executed_at = timezone.now()
        change_req.save(update_fields=["status", "executed_at"])

        return Response({
            "message": f"Student type changed to '{result['new_type']}' successfully.",
            **result,
        })

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Head Warden / Admin rejects the request."""
        user = request.user
        if getattr(user, "role", None) not in [
            ROLE_HEAD_WARDEN, ROLE_ADMIN, ROLE_SUPER_ADMIN
        ]:
            return api_error_response(
                "Only Head Warden / Admin can reject type change requests.",
                "PERMISSION_DENIED", 403
            )

        try:
            change_req = self.get_queryset().get(pk=pk)
        except StudentTypeChangeRequest.DoesNotExist:
            return api_error_response("Request not found.", "NOT_FOUND", 404)

        if change_req.status != "pending":
            return api_error_response(
                f"Request is already '{change_req.status}'. Cannot reject.",
                "INVALID_STATUS", 400
            )

        reason = request.data.get("reason", "").strip()
        change_req.status = "rejected"
        change_req.approved_by = user
        change_req.approved_at = timezone.now()
        change_req.rejection_reason = reason
        change_req.save(update_fields=[
            "status", "approved_by", "approved_at", "rejection_reason"
        ])

        return Response({
            "message": "Type change request rejected.",
            "id": change_req.id,
            "status": "rejected",
        })


class StudentTypeAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/student-type/audit/
    Admin-only read-only view of all type change audit records.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = StudentTypeAuditLogSerializer

    def get_queryset(self):
        user = self.request.user
        if not (user_is_admin(user) or user_is_warden(user)):
            return StudentTypeAuditLog.objects.none()

        qs = StudentTypeAuditLog.objects.select_related(
            "student", "performed_by"
        )
        # Tenant scope
        college_id = getattr(user, "college_id", None)
        if college_id and not getattr(user, "is_superuser", False):
            qs = qs.filter(student__college_id=college_id)

        return qs.order_by("-created_at")
