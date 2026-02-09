from rest_framework.routers import DefaultRouter
from .views import VisitorLogViewSet

router = DefaultRouter()
router.register(r'', VisitorLogViewSet, basename='visitor')

urlpatterns = router.urls
