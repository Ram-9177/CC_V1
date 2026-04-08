from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CompanyViewSet,
    JobPostingViewSet,
    ApplicationViewSet,
    OfferViewSet,
)

router = DefaultRouter()
router.register(r'companies', CompanyViewSet, basename='company')
router.register(r'jobs', JobPostingViewSet, basename='job')
router.register(r'job-postings', JobPostingViewSet, basename='job-posting')
router.register(r'applications', ApplicationViewSet, basename='application')
router.register(r'offers', OfferViewSet, basename='offer')

app_name = 'placements'

urlpatterns = [
    path('', include(router.urls)),
]
