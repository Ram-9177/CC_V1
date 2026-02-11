from django.urls import path
from .views import DownloadBackupView

urlpatterns = [
    path('backup/download/', DownloadBackupView.as_view(), name='backup-download'),
]
