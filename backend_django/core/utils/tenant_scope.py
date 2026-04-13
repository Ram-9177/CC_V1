"""
Optional queryset tenant guard — use only where scoping is missing.

Does not replace CollegeScopeMixin; safe to call when unsure (no-op for super_admin).
"""

from __future__ import annotations

from django.db.models import QuerySet

from core.permissions import user_is_super_admin


def enforce_tenant_scope(qs: QuerySet, request) -> QuerySet:
    """
    Apply college / tenant_id filter when the model supports it.

    - super_admin / Django superuser: unchanged
    - user without college: ``.none()`` for safety
    - model without ``college`` or ``tenant_id``: unchanged
    """
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return qs.none()

    if user_is_super_admin(user) or getattr(user, "is_superuser", False):
        return qs

    college = getattr(user, "college", None)
    college_id = getattr(user, "college_id", None) or (
        college.id if college is not None else None
    )
    if college_id is None:
        return qs.none()

    field_names = {f.name for f in qs.model._meta.get_fields()}
    if "college" in field_names:
        return qs.filter(college_id=college_id)
    if "tenant_id" in field_names:
        return qs.filter(tenant_id=str(college_id))
    return qs
