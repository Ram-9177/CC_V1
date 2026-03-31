"""
apps/users/student_type_serializers.py
========================================
Serializers for the Student Type workflow system.
"""
# pyre-ignore-all-errors
# pyright: reportMissingImports=false

from rest_framework import serializers  # type: ignore[import]
from apps.auth.models import User  # type: ignore[import]
from .student_type_service import (
    StudentTypeChangeRequest,
    StudentTypeAuditLog,
    STUDENT_TYPE_HOSTELLER,
    STUDENT_TYPE_DAY_SCHOLAR,
)

VALID_TYPES = [STUDENT_TYPE_HOSTELLER, STUDENT_TYPE_DAY_SCHOLAR]


class StudentTypeChangeRequestCreateSerializer(serializers.ModelSerializer):
    """Used for POST (creation) of a type change request."""

    student_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = StudentTypeChangeRequest
        fields = [
            "student_id",
            "new_type",
            "reason",
            "target_room_id",
            "target_bed_id",
        ]

    def validate_new_type(self, value):
        if value not in VALID_TYPES:
            raise serializers.ValidationError(
                f"new_type must be one of: {VALID_TYPES}"
            )
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        student_id = attrs.get("student_id")
        new_type = attrs.get("new_type")

        try:
            student = User.objects.get(id=student_id, role="student")
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {"student_id": "No student found with this ID."}
            )

        # Multi-tenant: check requester and student share same college
        if request and hasattr(request, "user"):
            requester_college = getattr(request.user, "college_id", None)
            student_college = getattr(student, "college_id", None)
            if (
                requester_college
                and student_college
                and requester_college != student_college
                and not getattr(request.user, "is_superuser", False)
            ):
                raise serializers.ValidationError(
                    {"student_id": "Student is from a different institution."}
                )

        # Require room when converting to hosteller
        if new_type == STUDENT_TYPE_HOSTELLER and not attrs.get("target_room_id"):
            raise serializers.ValidationError(
                {"target_room_id": "A target_room_id is required when converting to hosteller."}
            )

        attrs["student"] = student
        return attrs

    def create(self, validated_data):
        validated_data.pop("student_id", None)
        return StudentTypeChangeRequest.objects.create(**validated_data)


class StudentTypeChangeRequestSerializer(serializers.ModelSerializer):
    """Read serializer — full detail view."""

    student_name = serializers.SerializerMethodField()
    student_hall_ticket = serializers.SerializerMethodField()
    requested_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentTypeChangeRequest
        fields = [
            "id",
            "student", "student_name", "student_hall_ticket",
            "requested_by", "requested_by_name",
            "approved_by", "approved_by_name",
            "current_type", "new_type",
            "status", "reason", "rejection_reason",
            "target_room_id", "target_bed_id",
            "approved_at", "executed_at",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.get_full_name() if obj.student else None

    def get_student_hall_ticket(self, obj):
        return obj.student.registration_number if obj.student else None

    def get_requested_by_name(self, obj):
        return obj.requested_by.get_full_name() if obj.requested_by else None

    def get_approved_by_name(self, obj):
        return obj.approved_by.get_full_name() if obj.approved_by else None


class StudentTypeAuditLogSerializer(serializers.ModelSerializer):
    """Read-only audit log serializer."""

    student_name = serializers.SerializerMethodField()
    performed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentTypeAuditLog
        fields = [
            "id",
            "student", "student_name",
            "old_type", "new_type",
            "performed_by", "performed_by_name",
            "change_request_id",
            "notes",
            "created_at",
        ]
        read_only_fields = fields

    def get_student_name(self, obj):
        return obj.student.get_full_name() if obj.student else None

    def get_performed_by_name(self, obj):
        return obj.performed_by.get_full_name() if obj.performed_by else None
