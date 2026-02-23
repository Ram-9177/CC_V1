"""URL config for the /api/warmup/ endpoint."""

from django.urls import path
from .warmup import WarmupView

urlpatterns = [
    path('', WarmupView.as_view(), name='warmup'),
]
