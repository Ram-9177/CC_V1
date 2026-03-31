from django.urls import path
from .views import DownloadBackupView, SystemSettingsView
from .search_views import GlobalSearchViewSet
from core.feedback_views import UserFeedbackViewSet, SystemStatusViewSet
from apps.core.ai_views import CampusInsightsViewSet

urlpatterns = [
    path('backup/download/', DownloadBackupView.as_view(), name='backup-download'),
    path('settings/', SystemSettingsView.as_view(), name='system-settings'),
    path('search/', GlobalSearchViewSet.as_view({'get': 'search'}), name='global-search'),
    path('feedback/', UserFeedbackViewSet.as_view({'get': 'list', 'post': 'create'}), name='user-feedback'),
    path('status/', SystemStatusViewSet.as_view({'get': 'list'}), name='system-status'),
    path('insights/', CampusInsightsViewSet.as_view({'get': 'overview'}), name='campus-insights'),
    path('insights/student/<int:pk>/', CampusInsightsViewSet.as_view({'get': 'student_risk'}), name='student-risk'),
    path('insights/meal-forecast/', CampusInsightsViewSet.as_view({'get': 'meal_forecast'}), name='meal-forecast'),
]
