"""Colleges URL configuration."""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CollegeViewSet

router = DefaultRouter()
router.register(r'colleges', CollegeViewSet, basename='college')

app_name = 'colleges'

urlpatterns = [
    path('', include(router.urls)),
]
