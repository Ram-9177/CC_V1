# pyre-ignore-all-errors
# pyright: reportMissingImports=false
"""apps/users/student_type_urls.py — URL routing for the Student Type system."""

from django.urls import path, include  # type: ignore[import]
from rest_framework.routers import DefaultRouter  # type: ignore[import]

from .student_type_views import (  # type: ignore[import]
    StudentTypeStatusView,
    StudentTypeChangeRequestViewSet,
    StudentTypeAuditLogViewSet,
)

router = DefaultRouter()
router.register(r"requests", StudentTypeChangeRequestViewSet, basename="student-type-request")
router.register(r"audit", StudentTypeAuditLogViewSet, basename="student-type-audit")

urlpatterns = [
    # GET /api/student-type/status/ — current logged-in user's type + features
    path("status/", StudentTypeStatusView.as_view(), name="student-type-status"),
    # /api/student-type/requests/ and /api/student-type/audit/
    path("", include(router.urls)),
]
