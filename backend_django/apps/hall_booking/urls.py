"""URLs for hall booking module."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import HallBookingViewSet, HallEquipmentViewSet, HallSlotViewSet, HallViewSet

router = DefaultRouter()
router.register(r'halls', HallViewSet, basename='hall')
router.register(r'slots', HallSlotViewSet, basename='hall-slot')
router.register(r'equipment', HallEquipmentViewSet, basename='hall-equipment')
router.register(r'bookings', HallBookingViewSet, basename='hall-booking')

app_name = 'hall_booking'

urlpatterns = [
    path('', include(router.urls)),
]
