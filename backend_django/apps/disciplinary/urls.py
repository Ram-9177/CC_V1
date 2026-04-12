from rest_framework.routers import DefaultRouter
from .views import DisciplinaryActionViewSet

router = DefaultRouter()
router.register(r'', DisciplinaryActionViewSet, basename='disciplinary')

urlpatterns = router.urls
