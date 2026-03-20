from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EventActivityPointViewSet,
    EventFeedbackViewSet,
    EventTicketViewSet,
    EventViewSet,
    EventRegistrationViewSet,
)

router = DefaultRouter()
router.register(r'events', EventViewSet, basename='event')
router.register(r'registrations', EventRegistrationViewSet, basename='registration')
router.register(r'activity-points', EventActivityPointViewSet, basename='activity-point')
router.register(r'feedback', EventFeedbackViewSet, basename='event-feedback')
router.register(r'tickets', EventTicketViewSet, basename='event-ticket')

app_name = 'events'

urlpatterns = [
	path('', include(router.urls)),
]
