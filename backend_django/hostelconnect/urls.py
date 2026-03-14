"""
Main URL configuration for hostelconnect project.
"""

from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenRefreshView
from apps.auth import views as auth_views
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

from django.http import JsonResponse

# Health check endpoint (Plain Django for speed)
def health_check(request):
    """Health check endpoint."""
    return JsonResponse(
        {'status': 'ok', 'message': 'CampusCore API is running'},
        status=200
    )

# API root endpoint (Plain Django for speed)
def api_root(request):
    """API root endpoint."""
    return JsonResponse(
        {
            'status': 'ok',
            'message': 'CampusCore API root',
            'endpoints': {
                'health': '/api/health/',
                'auth': '/api/auth/',
                'users': '/api/users/',
                'colleges': '/api/colleges/',
                'rooms': '/api/rooms/',
                'meals': '/api/meals/',
                'attendance': '/api/attendance/',
                'gate_passes': '/api/gate-passes/',
                'gate_scans': '/api/gate-scans/',
                'events': '/api/events/',
                'notices': '/api/notices/',
                'notifications': '/api/notifications/',
                'messages': '/api/messages/',
                'reports': '/api/reports/',
                'metrics': '/api/metrics/',
                'visitors': '/api/visitors/',
                'leaves': '/api/leaves/',
                'hall_booking': '/api/hall-booking/',
                'sports': '/api/sports/',
            }
        },
        status=200,
    )

urlpatterns = [
    # API root
    path('api/', api_root, name='api-root'),
    # Health check (simple)
    path('health', health_check, name='health_root'),
    path('health/', health_check, name='health_root_slash'),
    path('api/health/', health_check, name='health-check'),
    path('api/health/ping/', health_check), # Support legacy/alternative ping paths

    # Expanded health endpoints for uptime checks
    # Warmup endpoint – touch DB + Redis + ORM; safe for UptimeRobot with no auth
    path('api/warmup/', include('apps.health.warmup_urls')),

    # Auth convenience aliases (for tests and clients)
    path('api/login/', auth_views.LoginView.as_view(), name='api-login'),
    path('api/profile/', auth_views.ProfileView.as_view(), name='api-profile'),
    path('api/token/refresh/', auth_views.CookieTokenRefreshView.as_view(), name='api-token-refresh'),
    
    # Swagger/OpenAPI documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/schema/swagger/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger'),
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    
    # Admin
    path('admin/', admin.site.urls),
    
    # API routes (auth endpoints included here)
    path('api/auth/', include('apps.auth.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/colleges/', include('apps.colleges.urls')),
    path('api/rooms/', include('apps.rooms.urls')),
    path('api/meals/', include('apps.meals.urls')),
    path('api/attendance/', include('apps.attendance.urls')),
    path('api/gate-passes/', include('apps.gate_passes.urls')),
    path('api/gate-scans/', include('apps.gate_scans.urls')),
    path('api/events/', include('apps.events.urls')),
    path('api/notices/', include('apps.notices.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api/messages/', include('apps.messages.urls')),
    path('api/reports/', include('apps.reports.urls')),
    path('api/metrics/', include('apps.metrics.urls')),
    path('api/complaints/', include('apps.complaints.urls')),
    path('api/visitors/', include('apps.visitors.urls')),
    path('api/disciplinary/', include('apps.disciplinary.urls')),
    path('api/health-check/', include('apps.health.urls')),
    path('api/core/', include('apps.core.urls')),
    path('api/superadmin/', include('apps.core.superadmin_urls')),
    path('api/leaves/', include('apps.leaves.urls')),
    path('api/hall-booking/', include('apps.hall_booking.urls')),
    path('api/sports/', include('apps.sports.urls')),

    # Web UI (Django templates)
    path('', include('apps.web.urls')),

    # SPA Catch-all: Redirect all non-API/non-admin routes to the frontend dashboard.
    # This prevents 'Not Found' on page refresh in environments where Django serves the frontend.
    re_path(r'^(?!api/|admin/|ws/|media/|static/).*$', auth_views.SPAView.as_view(), name='spa-fallback'),
]

from django.views.decorators.cache import never_cache

def serve_media(request, path, document_root=None, **kwargs):
    """Serve media files with a 1-year cache header."""
    response = serve(request, path, document_root, **kwargs)
    # Apply 1 year cache for profile images (path starting with profile_pictures/)
    if path.startswith('profile_pictures/'):
        response["Cache-Control"] = "public, max-age=31536000, immutable"
    return response

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve_media, {'document_root': settings.MEDIA_ROOT}),
    ]
