"""Rooms app URLs."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.rooms import views

router = DefaultRouter()
router.register(r'', views.RoomViewSet, basename='room')
router.register(r'allocations', views.RoomAllocationViewSet, basename='room-allocation')

urlpatterns = [
    path('', include(router.urls)),
]
