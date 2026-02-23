"""Messages URL configuration."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import MessageViewSet

router = DefaultRouter()
router.register(r'', MessageViewSet, basename='messages')

app_name = 'messages'

urlpatterns = [
    path('', include(router.urls)),
]
