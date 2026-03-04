from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import DisciplinaryAction
from .serializers import DisciplinaryActionSerializer
from core.permissions import IsWarden, IsAdmin, IsStudent
from core.role_scopes import get_warden_building_ids, user_is_top_level_management

class DisciplinaryActionViewSet(viewsets.ModelViewSet):
    """ViewSet for managing disciplinary actions."""
    serializer_class = DisciplinaryActionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action_type', 'severity', 'is_paid']
    search_fields = ['student__username', 'student__registration_number', 'title']
    ordering_fields = ['created_at', 'fine_amount']

    def get_queryset(self):
        user = self.request.user
        qs = DisciplinaryAction.objects.select_related('student').all()

        if user_is_top_level_management(user):
            return qs

        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            return qs.filter(student__room_allocations__room__building_id__in=warden_buildings, student__room_allocations__end_date__isnull=True).distinct()

        # PHASE 1: Students see ONLY their own fines
        if user.role == 'student':
            return qs.filter(student=user)

        return qs.none()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsWarden() | IsAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        """PHASE 1: Only warden+ can create fines. Students are blocked at permission level."""
        user = self.request.user
        if user.role == 'student' or (user.role == 'hr' and not user_is_top_level_management(user)):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Wardens and Admins can create disciplinary actions.")
        serializer.save(created_by=user)

