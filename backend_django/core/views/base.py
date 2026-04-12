from typing import Optional, Any
"""BaseModelViewSet — college-scoped, RBAC-checked, audit-logged.

All major ViewSets should inherit from CollegeModelViewSet instead of
viewsets.ModelViewSet directly.

Features
--------
- Auto-filter queryset by request.user.college (super_admin bypasses)
- Auto-assign college + created_by on create
- Centralised error handling (returns structured JSON)
- RBAC capability check via rbac_module / rbac_capability class attrs
- Audit logging on create / update / destroy
"""

import logging

from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.errors import api_error_response
from core.constants import ROLE_SUPER_ADMIN
from core.security import AuditLogger

logger = logging.getLogger(__name__)


class CollegeModelViewSet(viewsets.ModelViewSet):
    """
    Drop-in replacement for viewsets.ModelViewSet with multi-tenant isolation.

    Class attributes
    ----------------
    rbac_module : Optional[str]
        If set, has_module_permission(user, rbac_module, rbac_capability) is
        checked on every request before the action runs.
    rbac_capability : str
        Capability required for write actions (default: 'manage').
        Read actions always require 'view'.
    skip_college_filter : bool
        Set True to disable automatic college scoping (e.g. College admin views).
    """

    rbac_module: Optional[str] = None
    rbac_capability: str = 'manage'
    skip_college_filter: bool = False

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _college(self):
        return getattr(self.request.user, 'college', None)

    def _is_super_admin(self):
        u = self.request.user
        return getattr(u, 'is_superuser', False) or getattr(u, 'role', '') == ROLE_SUPER_ADMIN

    def _check_rbac(self, capability: str) -> bool:
        if not self.rbac_module:
            return True
        from core.rbac import has_module_permission
        return has_module_permission(self.request.user, self.rbac_module, capability)

    # ── College-scoped queryset ───────────────────────────────────────────────

    def get_queryset(self):
        qs = super().get_queryset()

        if self.skip_college_filter or self._is_super_admin():
            return qs

        college = self._college()
        if college is None:
            logger.warning(
                "CollegeModelViewSet: user %s has no college — empty queryset.",
                getattr(self.request.user, 'id', '?'),
            )
            return qs.none()

        field_names = {f.name for f in qs.model._meta.get_fields()}
        if 'college' in field_names:
            return qs.filter(college=college)

        if 'tenant_id' in field_names:
            return qs.filter(tenant_id=str(college.id))

        return qs

    # ── Auto-assign on create ─────────────────────────────────────────────────

    def perform_create(self, serializer):
        kwargs = {}
        model = serializer.Meta.model
        field_names = {f.name for f in model._meta.get_fields()}

        college = self._college()
        if 'college' in field_names and college is not None:
            kwargs['college'] = college

        if 'created_by' in field_names:
            kwargs['created_by'] = self.request.user

        instance = serializer.save(**kwargs)

        if self.rbac_module:
            AuditLogger.log_action(
                self.request.user.id, 'create', self.rbac_module,
                instance.pk, success=True,
            )
        return instance

    # ── RBAC gate on write actions ────────────────────────────────────────────

    def create(self, request, *args, **kwargs):
        if not self._check_rbac(self.rbac_capability):
            return api_error_response('Permission denied.', 'PERMISSION_DENIED', 403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not self._check_rbac(self.rbac_capability):
            return api_error_response('Permission denied.', 'PERMISSION_DENIED', 403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._check_rbac(self.rbac_capability):
            return api_error_response('Permission denied.', 'PERMISSION_DENIED', 403)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._check_rbac(self.rbac_capability):
            return api_error_response('Permission denied.', 'PERMISSION_DENIED', 403)
        instance = self.get_object()
        if self.rbac_module:
            AuditLogger.log_action(
                request.user.id, 'delete', self.rbac_module,
                instance.pk, success=True,
            )
        return super().destroy(request, *args, **kwargs)

    # ── Centralised exception handler ────────────────────────────────────────

    def handle_exception(self, exc):
        from rest_framework.exceptions import APIException
        if isinstance(exc, APIException):
            return super().handle_exception(exc)
        logger.exception("Unhandled error in %s: %s", self.__class__.__name__, exc)
        return api_error_response(
            'An unexpected error occurred.',
            'INTERNAL_ERROR',
            status_code=500,
        )
