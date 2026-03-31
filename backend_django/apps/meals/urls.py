"""Meals app URLs."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.meals import views

router = DefaultRouter()
router.register(r'feedback', views.MealFeedbackViewSet, basename='meal-feedback')
router.register(r'enhanced-feedback', views.EnhancedMealFeedbackViewSet, basename='enhanced-meal-feedback')
router.register(r'menu-notifications', views.MenuNotificationViewSet, basename='menu-notification')
router.register(r'special-requests', views.MealSpecialRequestViewSet, basename='meal-special-request')
router.register(r'feedback-responses', views.MealFeedbackResponseViewSet, basename='meal-feedback-response')
router.register(r'wastage', views.MealWastageViewSet, basename='meal-wastage')
router.register(r'', views.MealViewSet, basename='meal')

urlpatterns = [
    path('', include(router.urls)),
]