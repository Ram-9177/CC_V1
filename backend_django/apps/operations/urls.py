from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    BulkOperationViewSet,
    SystemConfigViewSet,
    AdminControlViewSet,
)

router = DefaultRouter()
router.register(r'bulk', BulkOperationViewSet, basename='bulk-ops')
router.register(r'config', SystemConfigViewSet, basename='system-config')
router.register(r'control', AdminControlViewSet, basename='admin-control')

app_name = 'operations'

urlpatterns = [
    path('', include(router.urls)),
]
