from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import DisciplinaryAction
from .serializers import DisciplinaryActionSerializer
from core.permissions import IsWarden, IsAdmin, IsStudent

class DisciplinaryActionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing disciplinary actions."""
    serializer_class = DisciplinaryActionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action_type', 'severity', 'is_paid']
    search_fields = ['student__username', 'student__registration_number', 'title']
    ordering_fields = ['created_at', 'fine_amount']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return DisciplinaryAction.objects.filter(student=user)
        return DisciplinaryAction.objects.all()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsWarden() | IsAdmin()]
        return [permissions.IsAuthenticated()]
