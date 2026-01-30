"""Metrics URL configuration."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MetricViewSet, dashboard_metrics, recent_activities

router = DefaultRouter()
router.register(r'metrics', MetricViewSet, basename='metric')

app_name = 'metrics'

urlpatterns = [
    path('dashboard/', dashboard_metrics, name='metrics-dashboard'),
    path('activities/', recent_activities, name='metrics-activities'),
    path('', include(router.urls)),
]
