"""Metrics URL configuration."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MetricViewSet, dashboard_metrics, recent_activities, chef_daily_stats, security_stats, advanced_dashboard_metrics, student_bundle, hostel_analytics

router = DefaultRouter()
router.register(r'metrics', MetricViewSet, basename='metric')

app_name = 'metrics'

urlpatterns = [
    path('dashboard/', dashboard_metrics, name='metrics-dashboard'),
    path('advanced-dashboard/', advanced_dashboard_metrics, name='advanced-metrics-dashboard'),
    path('chef-stats/', chef_daily_stats, name='chef-daily-stats'),
    path('security-stats/', security_stats, name='security-stats'),
    path('activities/', recent_activities, name='metrics-activities'),
    path('student-bundle/', student_bundle, name='student-bundle'),
    path('analytics/', hostel_analytics, name='hostel-analytics'),
    path('', include(router.urls)),
]
