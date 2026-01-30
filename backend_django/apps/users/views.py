"""Users app views."""
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsWarden
from apps.users.models import Tenant
from apps.users.serializers import TenantSerializer

class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated, IsAdmin | IsWarden]
