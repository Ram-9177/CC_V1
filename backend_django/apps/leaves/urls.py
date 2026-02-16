"""Leave Application URLs."""
from rest_framework.routers import DefaultRouter
from .views import LeaveApplicationViewSet

router = DefaultRouter()
router.register(r'', LeaveApplicationViewSet, basename='leave')

urlpatterns = router.urls
