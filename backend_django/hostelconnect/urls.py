"""
Main URL configuration for hostelconnect project.
"""

from django.contrib import admin # pyre-fixme[21]
from django.urls import path, include, re_path # pyre-fixme[21]
from django.views.static import serve # pyre-fixme[21]
from django.conf import settings # pyre-fixme[21]
from django.conf.urls.static import static # pyre-fixme[21]
from rest_framework import status # pyre-fixme[21]
from rest_framework.response import Response # pyre-fixme[21]
from rest_framework.decorators import api_view, permission_classes # pyre-fixme[21]
from rest_framework.permissions import AllowAny # pyre-fixme[21]
from rest_framework_simplejwt.views import TokenRefreshView # pyre-fixme[21]
from apps.auth import views as auth_views # pyre-fixme[21]
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView # pyre-fixme[21]

from django.http import JsonResponse # pyre-fixme[21]

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
    base_prefix = '/api/v1' if request.path.startswith('/api/v1/') else '/api'
    return JsonResponse(
        {
            'status': 'ok',
            'message': 'CampusCore API root',
            'endpoints': {
                'health': f'{base_prefix}/health/',
                'auth': f'{base_prefix}/auth/',
                'users': f'{base_prefix}/users/',
                'colleges': f'{base_prefix}/colleges/',
                'rooms': f'{base_prefix}/rooms/',
                'meals': f'{base_prefix}/meals/',
                'attendance': f'{base_prefix}/attendance/',
                'gate_passes': f'{base_prefix}/gate-passes/',
                'gate_scans': f'{base_prefix}/gate-scans/',
                'events': f'{base_prefix}/events/',
                'notices': f'{base_prefix}/notices/',
                'notifications': f'{base_prefix}/notifications/',
                'messages': f'{base_prefix}/messages/',
                'reports': f'{base_prefix}/reports/',
                'metrics': f'{base_prefix}/metrics/',
                'visitors': f'{base_prefix}/visitors/',
                'leaves': f'{base_prefix}/leaves/',
                'hall_booking': f'{base_prefix}/hall-booking/',
                'sports': f'{base_prefix}/sports/',
                'scan': f'{base_prefix}/scan/',
                'resume': f'{base_prefix}/resume/',
                'placements': f'{base_prefix}/placements/',
                'alumni': f'{base_prefix}/alumni/',
                'operations': f'{base_prefix}/operations/',
                'analytics': f'{base_prefix}/analytics/',
            }
        },
        status=200,
    )


def build_versioned_api_patterns(prefix: str):
    """Build API URL set for a given prefix, e.g. `api/v1/`."""
    return [
        path(prefix, api_root),
        path(f'{prefix}health/', health_check),
        path(f'{prefix}health/ping/', health_check),
        path(f'{prefix}warmup/', include('apps.health.warmup_urls', namespace='v1_warmup')),

        # Auth convenience aliases
        path(f'{prefix}login/', auth_views.LoginView.as_view()),
        path(f'{prefix}profile/', auth_views.ProfileView.as_view()),
        path(f'{prefix}token/refresh/', auth_views.CookieTokenRefreshView.as_view()),

        # Versioned docs
        path(f'{prefix}schema/', SpectacularAPIView.as_view()),
        path(f'{prefix}schema/swagger/', SpectacularSwaggerView.as_view(url_name='schema')),
        path(f'{prefix}schema/redoc/', SpectacularRedocView.as_view(url_name='schema')),

        # API routes
        path(f'{prefix}auth/', include('apps.auth.urls')),
        path(f'{prefix}users/', include('apps.users.urls')),
        path(f'{prefix}colleges/', include('apps.colleges.urls', namespace='v1_colleges')),
        path(f'{prefix}rooms/', include('apps.rooms.urls')),
        path(f'{prefix}meals/', include('apps.meals.urls')),
        path(f'{prefix}attendance/', include('apps.attendance.urls', namespace='v1_attendance')),
        path(f'{prefix}gate-passes/', include('apps.gate_passes.urls', namespace='v1_gate_passes')),
        path(f'{prefix}gate-scans/', include('apps.gate_scans.urls', namespace='v1_gate_scans')),
        path(f'{prefix}events/', include('apps.events.urls', namespace='v1_events')),
        path(f'{prefix}notices/', include('apps.notices.urls', namespace='v1_notices')),
        path(f'{prefix}notifications/', include('apps.notifications.urls', namespace='v1_notifications')),
        path(f'{prefix}messages/', include('apps.messages.urls', namespace='v1_messages')),
        path(f'{prefix}reports/', include('apps.reports.urls', namespace='v1_reports')),
        path(f'{prefix}metrics/', include('apps.metrics.urls', namespace='v1_metrics')),
        path(prefix, include('apps.complaints.urls', namespace='v1_complaints')),
        path(f'{prefix}visitors/', include('apps.visitors.urls')),
        path(f'{prefix}disciplinary/', include('apps.disciplinary.urls')),
        path(f'{prefix}audit/', include('apps.audit.urls')),
        path(f'{prefix}health-check/', include('apps.health.urls', namespace='v1_health_check')),
        path(f'{prefix}core/', include('apps.core.urls')),
        path(f'{prefix}superadmin/', include('apps.core.superadmin_urls')),
        path(f'{prefix}leaves/', include('apps.leaves.urls')),
        path(f'{prefix}hall-booking/', include('apps.hall_booking.urls', namespace='v1_hall_booking')),
        path(f'{prefix}sports/', include('apps.sports.urls')),
        path(f'{prefix}placements/', include('apps.placements.urls', namespace='v1_placements')),
        path(f'{prefix}alumni/', include('apps.alumni.urls', namespace='v1_alumni')),
        path(f'{prefix}operations/', include('apps.operations.urls', namespace='v1_operations')),
        path(f'{prefix}analytics/', include('apps.analytics.urls', namespace='v1_analytics')),
        path(f'{prefix}search/', include('core.search_urls')),
        path(f'{prefix}scan/', include('apps.scan.urls')),
        path(f'{prefix}resume/', include('apps.resume_builder.urls')),
        path(f'{prefix}student-type/', include('apps.users.student_type_urls')),
    ]

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
    path('api/', include('apps.complaints.urls')),
    path('api/visitors/', include('apps.visitors.urls')),
    path('api/disciplinary/', include('apps.disciplinary.urls')),
    path('api/audit/', include('apps.audit.urls')),
    path('api/health-check/', include('apps.health.urls')),
    path('api/core/', include('apps.core.urls')),
    path('api/superadmin/', include('apps.core.superadmin_urls')),
    path('api/leaves/', include('apps.leaves.urls')),
    path('api/hall-booking/', include('apps.hall_booking.urls')),
    path('api/sports/', include('apps.sports.urls')),
    path('api/placements/', include('apps.placements.urls')),
    path('api/alumni/', include('apps.alumni.urls')),
    path('api/operations/', include('apps.operations.urls')),
    path('api/analytics/', include('apps.analytics.urls')),
    path('api/search/', include('core.search_urls')),

    # Unified QR scan endpoint — resolves GP/SP/EV/TK/HB tokens
    path('api/scan/', include('apps.scan.urls')),

    # Resume Builder
    path('api/resume/', include('apps.resume_builder.urls')),

    # Student Type Workflow (Hosteller / Day Scholar system)
    path('api/student-type/', include('apps.users.student_type_urls')),

    # Web UI (Django templates)
    path('', include('apps.web.urls')),

    # SPA Catch-all: Redirect all non-API/non-admin routes to the frontend dashboard.
    # This prevents 'Not Found' on page refresh in environments where Django serves the frontend.
    re_path(r'^(?!api/|admin/|ws/|media/|static/).*$', auth_views.SPAView.as_view(), name='spa-fallback'),
]

# Versioned API alias (non-breaking): keep existing /api/* and support /api/v1/*
urlpatterns += build_versioned_api_patterns('api/v1/')

if settings.DEBUG:
    from apps.notifications.ws_views import test_ws

    urlpatterns += [
        path('api/debug/test-ws/', test_ws),
        path('api/v1/debug/test-ws/', test_ws),
    ]

from django.views.decorators.cache import never_cache # pyre-fixme[21]

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
