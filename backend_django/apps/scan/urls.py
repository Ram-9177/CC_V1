"""Unified QR scan URL configuration."""

from django.urls import path
from .views import UnifiedScanView, UnifiedScanActionView

urlpatterns = [
    path('', UnifiedScanView.as_view(), name='unified-scan'),
    path('action/', UnifiedScanActionView.as_view(), name='unified-scan-action'),
]
