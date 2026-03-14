from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r'sports', views.SportViewSet, basename='sport')
router.register(r'courts', views.SportCourtViewSet, basename='sport-court')
router.register(r'slots', views.CourtSlotViewSet, basename='court-slot')
router.register(r'policy', views.SportsPolicyViewSet, basename='sports-policy')
router.register(r'bookings', views.SportBookingViewSet, basename='sport-booking')
router.register(r'dept-requests', views.DepartmentSportsRequestViewSet, basename='dept-sports-request')

urlpatterns = [
    path('', include(router.urls)),
]
