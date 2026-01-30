"""Gate scans URL configuration."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GateScanViewSet

router = DefaultRouter()
router.register(r'gate-scans', GateScanViewSet, basename='gate-scan')

app_name = 'gate_scans'

urlpatterns = [
    path('', include(router.urls)),
]
