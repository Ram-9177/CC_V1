from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AlumniProfileViewSet,
    MentorshipViewSet,
)

router = DefaultRouter()
router.register(r'profile', AlumniProfileViewSet, basename='alumni-profile')
router.register(r'mentorship', MentorshipViewSet, basename='mentorship')

app_name = 'alumni'

urlpatterns = [
    path('', include(router.urls)),
]
