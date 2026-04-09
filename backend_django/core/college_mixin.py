"""College-scoped queryset mixin.

Attach to any ViewSet to get automatic college isolation.
super_admin bypasses the filter so they can see all colleges.
"""
import logging

from core.constants import ROLE_SUPER_ADMIN

logger = logging.getLogger(__name__)


class CollegeScopeMixin:
    """
    Mixin that restricts querysets to the requesting user's college.

    Usage:
        class MyViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
            ...

    Rules:
    - super_admin: no filter (cross-college visibility)
    - everyone else: queryset.filter(college=request.user.college)
    - If the model has no college field, the mixin is a no-op (safe fallback).
    """

    # Set to True on a ViewSet to skip college filtering entirely (use sparingly)
    skip_college_filter: bool = False

    def _get_college(self):
        return getattr(self.request.user, 'college', None)

    def _is_super_admin(self):
        user = self.request.user
        return getattr(user, 'is_superuser', False) or getattr(user, 'role', '') == ROLE_SUPER_ADMIN

    def get_queryset(self):
        qs = super().get_queryset()

        if self.skip_college_filter or self._is_super_admin():
            return qs

        college = self._get_college()
        if college is None:
            # User has no college assigned — return empty queryset to prevent data leak
            logger.warning(
                "CollegeScopeMixin: user %s has no college assigned, returning empty queryset.",
                getattr(self.request.user, 'id', '?'),
            )
            return qs.none()

        # Only filter if the model actually has recognized tenant fields
        field_names = {f.name for f in qs.model._meta.get_fields()}
        if 'college' in field_names:
            return qs.filter(college=college)
        
        if 'tenant_id' in field_names:
            return qs.filter(tenant_id=str(college.id))

        return qs

    def perform_create(self, serializer):
        """Auto-assign college or tenant_id on create when the model supports it."""
        college = self._get_college()
        model = serializer.Meta.model
        field_names = {f.name for f in model._meta.get_fields()}
        if 'college' in field_names and college is not None:
            serializer.save(college=college)
        elif 'tenant_id' in field_names and college is not None:
            serializer.save(tenant_id=str(college.id))
        else:
            super().perform_create(serializer)
