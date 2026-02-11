"""
Main URL configuration for hostelconnect project.
"""

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenRefreshView
from apps.auth import views as auth_views

# Health check endpoint
@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint."""
    return Response(
        {'status': 'ok', 'message': 'HostelConnect API is running'},
        status=status.HTTP_200_OK
    )

# API root endpoint
@api_view(['GET'])
@permission_classes([AllowAny])
def api_root(request):
    """API root endpoint."""
    return Response(
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
            }
        },
        status=status.HTTP_200_OK,
    )

urlpatterns = [
    # API root
    path('api/', api_root, name='api-root'),
    # Health check
    path('api/health/', health_check, name='health-check'),

    # Auth endpoints (required)
    path('api/register/', auth_views.RegisterView.as_view(), name='api-register'),
    path('api/login/', auth_views.LoginView.as_view(), name='api-login'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='api-token-refresh'),
    path('api/profile/', auth_views.ProfileView.as_view(), name='api-profile'),
    
    # Admin
    path('admin/', admin.site.urls),
    
    # API routes
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

    # Web UI (Django templates)
    path('', include('apps.web.urls')),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
