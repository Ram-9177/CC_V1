"""Sports app URLs."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.sports.views import (
    SportFacilityViewSet as LegacySportFacilityViewSet,
    SportBookingViewSet as LegacySportBookingViewSet,
    SportsMatchViewSet as LegacySportsMatchViewSet,
)
from apps.sports.compat_views import (
    CourtSlotViewSet,
    DepartmentSportsRequestViewSet,
    SportCourtViewSet,
    SportEquipmentIssueViewSet,
    SportEquipmentViewSet,
    SportsCatalogViewSet,
    SportsFacilitiesCompatibilityViewSet,
    SportsPolicyViewSet,
    SportSlotBookingViewSet,
)

router = DefaultRouter()
# Frontend-compatible Sports contract
router.register('sports', SportsCatalogViewSet, basename='sports-catalog')
router.register('courts', SportCourtViewSet, basename='sports-courts')
router.register('slots', CourtSlotViewSet, basename='sports-slots')
router.register('policy', SportsPolicyViewSet, basename='sports-policy')
router.register('equipment', SportEquipmentViewSet, basename='sports-equipment')
router.register('equipment-issues', SportEquipmentIssueViewSet, basename='sports-equipment-issues')
router.register('dept-requests', DepartmentSportsRequestViewSet, basename='sports-department-requests')
router.register('bookings', SportSlotBookingViewSet, basename='sports-bookings')
router.register('facilities', SportsFacilitiesCompatibilityViewSet, basename='sports-facilities')

# Legacy routes kept for backward compatibility
router.register('legacy-facilities', LegacySportFacilityViewSet, basename='legacy-facility')
router.register('legacy-bookings', LegacySportBookingViewSet, basename='legacy-booking')
router.register('matches', LegacySportsMatchViewSet, basename='match')

urlpatterns = [
    path('', include(router.urls)),
]
