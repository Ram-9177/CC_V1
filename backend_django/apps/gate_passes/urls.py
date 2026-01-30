"""Gate passes URL configuration."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GatePassViewSet

router = DefaultRouter()
router.register(r'', GatePassViewSet, basename='gate-pass')

app_name = 'gate_passes'

urlpatterns = [
    path('', include(router.urls)),
]
