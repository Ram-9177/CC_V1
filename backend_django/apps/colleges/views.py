"""Colleges views."""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsTopLevel
from .models import College
from .serializers import CollegeSerializer


class CollegeViewSet(viewsets.ModelViewSet):
    """ViewSet for College management."""
    
    queryset = College.objects.all()
    serializer_class = CollegeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Only admins can create/update."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsTopLevel]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
