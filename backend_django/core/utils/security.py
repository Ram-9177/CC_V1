"""Optional guards for authenticated + tenant context (use from mixins/views explicitly)."""

from __future__ import annotations

from rest_framework.exceptions import NotAuthenticated, PermissionDenied

from core.constants import ROLE_SUPER_ADMIN


def assert_authenticated_and_college(user) -> None:
    """
    Raise DRF NotAuthenticated / PermissionDenied if the user lacks a college.

    Superusers and ``super_admin`` role are allowed without a college (platform scope).
    """
    if user is None or not getattr(user, "is_authenticated", False):
        raise NotAuthenticated()

    if getattr(user, "is_superuser", False) or getattr(user, "role", "") == ROLE_SUPER_ADMIN:
        return

    if getattr(user, "college_id", None) is None:
        raise PermissionDenied(detail="College context is required for this action.")
