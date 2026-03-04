"""URLs for Super Admin features."""
from django.urls import path
from .superadmin_views import (
    ToggleCollegeView, ToggleHostelView, 
    ToggleBlockView, ToggleFloorView
)

urlpatterns = [
    path('toggle-college', ToggleCollegeView.as_view(), name='superadmin-toggle-college'),
    path('toggle-hostel', ToggleHostelView.as_view(), name='superadmin-toggle-hostel'),
    path('toggle-block', ToggleBlockView.as_view(), name='superadmin-toggle-block'),
    path('toggle-floor', ToggleFloorView.as_view(), name='superadmin-toggle-floor'),
]
