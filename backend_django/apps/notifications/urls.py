"""Notifications URL configuration."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, NotificationPreferenceViewSet, WebPushSubscriptionView

router = DefaultRouter()
router.register(r'notifications', NotificationViewSet, basename='notification')
router.register(r'preferences', NotificationPreferenceViewSet, basename='preference')

app_name = 'notifications'

urlpatterns = [
    path('webpush/subscribe/', WebPushSubscriptionView.as_view(), name='webpush-subscribe'),
    path('', include(router.urls)),
]
