"""Database models for the RBAC (Role-Based Access Control) system.

Tables
------
  roles            – all named roles (super_admin, warden, student, …)
  modules          – functional modules (hostel, gatepass, notices, …)
  permissions      – permission levels (view, approve, manage, full, …)
  role_permissions – maps role + module → permission level (one row per pair)
"""

from django.db import models


class Role(models.Model):
    """A named role that can be assigned to a user."""

    slug = models.CharField(max_length=30, unique=True, db_index=True,
                            help_text="Internal key matching User.role (e.g. 'warden')")
    name = models.CharField(max_length=100,
                            help_text="Human-readable label (e.g. 'Warden')")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = 'rbac'
        ordering = ['name']
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'

    def __str__(self) -> str:
        return self.name


class Module(models.Model):
    """A functional module in the application (e.g. Hostel, Gatepass)."""

    slug = models.CharField(max_length=30, unique=True, db_index=True,
                            help_text="Internal key (e.g. 'gatepass')")
    name = models.CharField(max_length=100,
                            help_text="Human-readable label (e.g. 'Gate Pass')")
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        app_label = 'rbac'
        ordering = ['name']
        verbose_name = 'Module'
        verbose_name_plural = 'Modules'

    def __str__(self) -> str:
        return self.name


class Permission(models.Model):
    """A named permission level (e.g. view, approve, manage, full)."""

    slug = models.CharField(max_length=50, unique=True, db_index=True,
                            help_text="Internal key (e.g. 'approve')")
    name = models.CharField(max_length=100,
                            help_text="Human-readable label (e.g. 'Approve')")
    description = models.TextField(blank=True)

    class Meta:
        app_label = 'rbac'
        ordering = ['slug']
        verbose_name = 'Permission'
        verbose_name_plural = 'Permissions'

    def __str__(self) -> str:
        return f'{self.name} ({self.slug})'


class RolePermission(models.Model):
    """Assigns a permission level to a role for a specific module.

    There is exactly ONE row per (role, module) pair.  Updating the
    *permission* FK changes the level for that role's module access.
    """

    role = models.ForeignKey(
        Role, on_delete=models.CASCADE, related_name='module_permissions')
    module = models.ForeignKey(
        Module, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name='role_permissions')

    class Meta:
        app_label = 'rbac'
        unique_together = [('role', 'module')]
        ordering = ['role__name', 'module__name']
        verbose_name = 'Role Permission'
        verbose_name_plural = 'Role Permissions'

    def __str__(self) -> str:
        return f'{self.role.name} → {self.module.name} : {self.permission.name}'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Bust the RBAC permission cache for ALL users with this role so the
        # new permission level takes effect within seconds.
        try:
            from apps.auth.models import User
            from core.rbac import clear_user_permission_cache
            for uid in User.objects.filter(role=self.role.slug).values_list('id', flat=True):
                clear_user_permission_cache(uid)
        except Exception:
            pass  # Never break a save because of cache invalidation
