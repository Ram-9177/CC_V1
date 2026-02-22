from django.urls import path
from . import views

urlpatterns = [
    path('healthz', views.healthz, name='healthz'),
    path('ping-db', views.ping_db, name='ping-db'),
    path('ping-redis', views.ping_redis, name='ping-redis'),
]
