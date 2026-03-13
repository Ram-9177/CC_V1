"""Django admin registration for RBAC models."""

from django.contrib import admin

from apps.rbac.models import Module, Permission, Role, RolePermission


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['slug', 'name', 'is_active']
    search_fields = ['slug', 'name']
    ordering = ['name']
    list_filter = ['is_active']


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ['slug', 'name', 'is_active']
    search_fields = ['slug', 'name']
    ordering = ['name']
    list_filter = ['is_active']


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['slug', 'name', 'description']
    search_fields = ['slug', 'name']
    ordering = ['slug']


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ['role', 'module', 'permission']
    list_filter = ['role__slug', 'module__slug', 'permission__slug']
    search_fields = ['role__name', 'module__name', 'permission__name']
    autocomplete_fields = ['role', 'module', 'permission']
    list_select_related = ['role', 'module', 'permission']

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related('role', 'module', 'permission')
        )
