"""Attendance URL configuration."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AttendanceViewSet, AttendanceReportViewSet

router = DefaultRouter()
router.register(r'', AttendanceViewSet, basename='attendance')
router.register(r'reports', AttendanceReportViewSet, basename='attendance-report')

app_name = 'attendance'

urlpatterns = [
    path('', include(router.urls)),
]
