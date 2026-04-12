"""Core middleware for tenant isolation."""
import logging
from typing import Optional

from django.core.cache import cache
from django.utils.deprecation import MiddlewareMixin
from core.constants import ROLE_SUPER_ADMIN

logger = logging.getLogger(__name__)

TENANT_CACHE_TTL_SECONDS = 300
_MISSING_TENANT = '__missing__'

class TenantMiddleware(MiddlewareMixin):
    """
    Middleware to handle tenant (College) isolation.
    Attaches the current college to the request object based on the authenticated user.
    """

    @staticmethod
    def _resolve_college_by_id(college_id: Optional[int]):
        if not college_id:
            return None

        cache_key = f"tenant:college:{college_id}"
        cached = cache.get(cache_key)
        if cached == _MISSING_TENANT:
            return None
        if cached is not None:
            return cached

        from apps.colleges.models import College

        college = College.objects.filter(id=college_id, is_active=True).first()
        cache.set(cache_key, college if college is not None else _MISSING_TENANT, TENANT_CACHE_TTL_SECONDS)
        return college

    @staticmethod
    def _resolve_college_from_subdomain(request):
        host = (request.get_host() or '').split(':', 1)[0].strip().lower()
        if not host:
            return None

        parts = host.split('.')
        if len(parts) < 3:
            return None

        subdomain = parts[0]
        if subdomain in {'www', 'api', 'localhost'}:
            return None

        id_key = f"tenant:subdomain:{subdomain}"
        cached_id = cache.get(id_key)

        if cached_id is None:
            from apps.colleges.models import College

            college = College.objects.filter(code__iexact=subdomain, is_active=True).only('id').first()
            cached_id = college.id if college else 0
            cache.set(id_key, cached_id, TENANT_CACHE_TTL_SECONDS)

        if cached_id == 0:
            return None

        return TenantMiddleware._resolve_college_by_id(cached_id)
    
    def process_request(self, request):
        request.tenant = None
        request.tenant_id = None

        try:
            if request.user.is_authenticated:
                college_id = getattr(request.user, 'college_id', None)
                if college_id:
                    request.tenant = self._resolve_college_by_id(college_id)
                    request.tenant_id = college_id

            if request.tenant is None:
                tenant = self._resolve_college_from_subdomain(request)
                request.tenant = tenant
                request.tenant_id = getattr(tenant, 'id', None)
        except Exception as e:
            logger.error(f"TenantMiddleware error: {e}")
            request.tenant = None
            request.tenant_id = None

    def process_view(self, request, view_func, view_args, view_kwargs):
        """
        Optional: Strictly enforce tenant presence for specific paths.
        """
        path = request.path
        # Allow public and auth paths
        if (
            path.startswith('/api/auth/')
            or path.startswith('/api/v1/auth/')
            or path.startswith('/admin/')
            or path.startswith('/health')
        ):
            return None
            
        # If user is authenticated but has no tenant and isn't a superuser, block access to data
        if request.user.is_authenticated and not request.tenant and not request.user.is_superuser:
            # Only platform_admins or superusers should be 'tenant-less'
            if getattr(request.user, 'role', None) not in ['platform_admin', ROLE_SUPER_ADMIN]:
                logger.warning(f"User {request.user.id} accessed {path} without a tenant.")
                # We don't raise 403 here to avoid breaking initial login/profile setup, 
                # but we'll enforce it in the queryset layer.
        
        return None
