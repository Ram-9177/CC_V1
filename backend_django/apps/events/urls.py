from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventActivityPointViewSet,
    EventFeedbackViewSet,
    EventTicketViewSet,
    EventViewSet,
    EventRegistrationViewSet,
    SportsCourtViewSet, SportsBookingConfigViewSet
)

router = DefaultRouter()
router.register(r'events', EventViewSet, basename='event')
router.register(r'registrations', EventRegistrationViewSet, basename='registration')
router.register(r'activity-points', EventActivityPointViewSet, basename='activity-point')
router.register(r'feedback', EventFeedbackViewSet, basename='event-feedback')
router.register(r'tickets', EventTicketViewSet, basename='event-ticket')
router.register(r'sports-courts', SportsCourtViewSet, basename='sports-court')
router.register(r'sports-config', SportsBookingConfigViewSet, basename='sports-config')

app_name = 'events'

urlpatterns = [
	path('', include(router.urls)),
]
