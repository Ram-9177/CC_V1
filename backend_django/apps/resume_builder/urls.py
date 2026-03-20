from django.urls import path
from . import views

urlpatterns = [
    path('profile/', views.ResumeProfileView.as_view(), name='resume-profile'),
    path('templates/', views.ResumeTemplatesView.as_view(), name='resume-templates'),
    path('generate/', views.ResumeGenerateView.as_view(), name='resume-generate'),
    path('preview/', views.ResumePreviewView.as_view(), name='resume-preview'),
    path('update/', views.ResumeUpdateView.as_view(), name='resume-update'),
    path('download/', views.ResumeDownloadView.as_view(), name='resume-download'),
]
