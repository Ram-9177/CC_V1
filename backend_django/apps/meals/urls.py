"""Meals app URLs."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.meals import views

router = DefaultRouter()
router.register(r'', views.MealViewSet, basename='meal')

urlpatterns = [
    path('', include(router.urls)),
]
