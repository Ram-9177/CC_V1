from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SportViewSet, SportCourtViewSet, CourtSlotViewSet, SportBookingViewSet, AnalyticsViewSet

router = DefaultRouter()
router.register(r'types', SportViewSet)
router.register(r'courts', SportCourtViewSet)
router.register(r'slots', CourtSlotViewSet)
router.register(r'bookings', SportBookingViewSet)
router.register(r'analytics', AnalyticsViewSet, basename='sports-analytics')

urlpatterns = [
    path('', include(router.urls)),
]