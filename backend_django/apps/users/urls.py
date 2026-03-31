"""Users app URLs."""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.users import views
from apps.users.import_views import StudentImportViewSet
from apps.users.views import student_search, student_digital_id

router = DefaultRouter()
router.register(r'tenants', views.TenantViewSet)
router.register(r'import', StudentImportViewSet, basename='student-import')

urlpatterns = [
    path('students/', student_search, name='student_search'),
    path('digital-id/', student_digital_id, name='student_digital_id'),
    path('', include(router.urls)),
]
