"""Meals app URLs."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.meals import views

router = DefaultRouter()
router.register(r'feedback', views.MealFeedbackViewSet, basename='meal-feedback')
router.register(r'special-requests', views.MealSpecialRequestViewSet, basename='meal-special-request')
router.register(r'', views.MealViewSet, basename='meal')

urlpatterns = [
    path('', include(router.urls)),
]
