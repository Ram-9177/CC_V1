from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='web-dashboard'),
    path('login/', views.login_view, name='web-login'),
    path('register/', views.register_view, name='web-register'),
    path('attendance/', views.attendance, name='web-attendance'),
    path('colleges/', views.colleges, name='web-colleges'),
    path('events/', views.events, name='web-events'),
    path('gate-passes/', views.gate_passes, name='web-gate-passes'),
    path('gate-scans/', views.gate_scans, name='web-gate-scans'),
    path('meals/', views.meals, name='web-meals'),
    path('messages/', views.messages, name='web-messages'),
    path('metrics/', views.metrics, name='web-metrics'),
    path('notices/', views.notices, name='web-notices'),
    path('notifications/', views.notifications, name='web-notifications'),
    path('reports/', views.reports, name='web-reports'),
    path('rooms/', views.rooms, name='web-rooms'),
    path('users/', views.users, name='web-users'),
    path('profile/', views.profile, name='web-profile'),
]
