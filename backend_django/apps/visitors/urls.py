from rest_framework.routers import DefaultRouter
from .views import VisitorLogViewSet, VisitorPreRegistrationViewSet

router = DefaultRouter()
router.register(r'pre-registrations', VisitorPreRegistrationViewSet, basename='visitor-prereg')
router.register(r'', VisitorLogViewSet, basename='visitor')

urlpatterns = router.urls
