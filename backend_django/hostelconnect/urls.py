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
        {'status': 'ok', 'message': 'HostelConnect API is running'},
        status=200
    )

# API root endpoint (Plain Django for speed)
def api_root(request):
    """API root endpoint."""
    return JsonResponse(
        {
            'status': 'ok',
            'message': 'HostelConnect API root',
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
            }
        },
        status=200,
    )

urlpatterns = [
    # API root
    path('api/', api_root, name='api-root'),
    # Health check (simple)
    path('api/health/', health_check, name='health-check'),
    # Expanded health endpoints for uptime checks
    # Warmup endpoint – touch DB + Redis + ORM; safe for UptimeRobot with no auth
    path('api/warmup/', include('apps.health.warmup_urls')),

    # Auth convenience aliases (for tests and clients)
    path('api/login/', auth_views.LoginView.as_view(), name='api-login'),
    path('api/profile/', auth_views.ProfileView.as_view(), name='api-profile'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='api-token-refresh'),
    
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
    path('api/leaves/', include('apps.leaves.urls')),

    # Web UI (Django templates)
    path('', include('apps.web.urls')),
]

# Serve media files (Hotfix for production image serving)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
