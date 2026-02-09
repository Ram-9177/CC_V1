"""Rooms app URLs."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.rooms import views

router = DefaultRouter()
router.register(r'mapping', views.RoomMappingViewSet, basename='room-mapping')
router.register(r'allocations', views.RoomAllocationViewSet, basename='room-allocation')
router.register(r'buildings', views.BuildingViewSet, basename='building')
router.register(r'beds', views.BedViewSet, basename='bed')
router.register(r'', views.RoomViewSet, basename='room')

urlpatterns = [
    path('', include(router.urls)),
]
