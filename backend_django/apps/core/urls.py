from django.urls import path
from .views import DownloadBackupView, SystemSettingsView

urlpatterns = [
    path('backup/download/', DownloadBackupView.as_view(), name='backup-download'),
    path('settings/', SystemSettingsView.as_view(), name='system-settings'),
]
