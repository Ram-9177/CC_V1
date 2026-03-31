from django.urls import path, include
from rest_framework.routers import SimpleRouter
from .views import ComplaintViewSet

router = SimpleRouter()
router.register(r'complaints', ComplaintViewSet, basename='complaint')

app_name = 'complaints'

urlpatterns = [
    path('', include(router.urls)),
]
