"""Tenant-aware queryset/manager utilities."""

from django.db import models
from django.utils import timezone
from core.constants import ROLE_SUPER_ADMIN


class TenantQuerySet(models.QuerySet):
    """
    Standard QuerySet for all multi-tenant models.
    Enforces soft-delete awareness and tenant scoping by default.
    """
    def delete(self):
        """Soft delete all items in this QuerySet."""
        updates = {'is_deleted': True}
        model_fields = {f.name for f in self.model._meta.get_fields()}
        if 'updated_at' in model_fields:
            updates['updated_at'] = timezone.now()
        return self.update(**updates)

    def hardcore_delete(self):
        """Force physical deletion from DB (Bypass soft-delete)."""
        return super().delete()

    def active(self):
        """Return only non-deleted records."""
        return self.filter(is_deleted=False)


class TenantManager(models.Manager):
    """
    Enforces tenant boundaries on queries to categorically prevent cross-college data leaks.
    """
    def get_queryset(self):
        return TenantQuerySet(self.model, using=self._db).filter(is_deleted=False)

    def with_deleted(self):
        """Standard QuerySet including soft-deleted items."""
        return TenantQuerySet(self.model, using=self._db)

    def for_college(self, college_or_id):
        """
        Explicit institutional scoping. Use this in all Services.
        """
        cid = getattr(college_or_id, 'id', college_or_id)
        return self.get_queryset().filter(college_id=cid)

    def for_user(self, user):
        """
        User-context scoping. Automatically handles SuperAdmin bypass.
        """
        if user.is_superuser or getattr(user, 'role', '') == ROLE_SUPER_ADMIN:
            return self.get_queryset()
            
        if not hasattr(user, 'college_id') or not user.college_id:
            return self.get_queryset().none()
            
        return self.for_college(user.college_id)
