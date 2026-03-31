"""Core middleware for tenant isolation."""
import logging
from django.utils.deprecation import MiddlewareMixin
from django.core.exceptions import PermissionDenied

logger = logging.getLogger(__name__)

class TenantMiddleware(MiddlewareMixin):
    """
    Middleware to handle tenant (College) isolation.
    Attaches the current college to the request object based on the authenticated user.
    """
    
    def process_request(self, request):
        if request.user.is_authenticated:
            # Most models in this system use 'college' as the tenant field
            # We assume User has a 'college' field or we derive it from their profile
            try:
                # Use getattr to allow for users without college (like platform admins)
                request.tenant = getattr(request.user, 'college', None)
                request.tenant_id = getattr(request, 'tenant', None).id if request.tenant else None
            except Exception as e:
                logger.error(f"TenantMiddleware error: {e}")
                request.tenant = None
                request.tenant_id = None
        else:
            request.tenant = None
            request.tenant_id = None

    def process_view(self, request, view_func, view_args, view_kwargs):
        """
        Optional: Strictly enforce tenant presence for specific paths.
        """
        path = request.path
        # Allow public and auth paths
        if path.startswith('/api/auth/') or path.startswith('/admin/') or path.startswith('/health'):
            return None
            
        # If user is authenticated but has no tenant and isn't a superuser, block access to data
        if request.user.is_authenticated and not request.tenant and not request.user.is_superuser:
            # Only platform_admins or superusers should be 'tenant-less'
            if getattr(request.user, 'role', None) not in ['platform_admin', 'super_admin']:
                logger.warning(f"User {request.user.id} accessed {path} without a tenant.")
                # We don't raise 403 here to avoid breaking initial login/profile setup, 
                # but we'll enforce it in the queryset layer.
        
        return None
