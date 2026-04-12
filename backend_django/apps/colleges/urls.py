"""Colleges URL configuration."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CollegeViewSet, SuperAdminAnalyticsView

router = DefaultRouter()
router.register(r'colleges', CollegeViewSet, basename='college')

app_name = 'colleges'

urlpatterns = [
    path('', include(router.urls)),
    # Platform-wide analytics for super_admin
    path('platform-analytics/', SuperAdminAnalyticsView.as_view(), name='platform-analytics'),
]
