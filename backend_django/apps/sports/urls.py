"""Sports app URLs."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.sports.views import SportFacilityViewSet, SportBookingViewSet, SportsMatchViewSet

router = DefaultRouter()
router.register('facilities', SportFacilityViewSet, basename='facility')
router.register('bookings', SportBookingViewSet, basename='booking')
router.register('matches', SportsMatchViewSet, basename='match')

urlpatterns = [
    path('', include(router.urls)),
]
