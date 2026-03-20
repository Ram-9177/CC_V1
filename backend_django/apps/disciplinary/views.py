from rest_framework import viewsets, permissions, filters
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import DisciplinaryAction
from .serializers import DisciplinaryActionSerializer
from core.permissions import IsWarden, IsAdmin
from core.college_mixin import CollegeScopeMixin
from core.role_scopes import get_warden_building_ids, user_is_top_level_management

class DisciplinaryActionViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for managing disciplinary actions."""
    serializer_class = DisciplinaryActionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action_type', 'severity', 'is_paid']
    search_fields = ['student__username', 'student__registration_number', 'title']
    ordering_fields = ['created_at', 'fine_amount']

    def get_queryset(self):
        user = self.request.user
        # Apply college scoping via mixin first
        base_qs = super().get_queryset()
        qs = base_qs.select_related('student')

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
            return [(IsWarden | IsAdmin)()]
        return [permissions.IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        from django.core.cache import cache
        import hashlib
        user = request.user
        query_params = request.query_params.urlencode()
        params_hash = hashlib.md5(query_params.encode()).hexdigest()[:12]
        cache_key = f"hc:disciplinary:list:{user.role}:{user.id}:{params_hash}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
            
        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 60) # 1 min cache
        return response


    def perform_create(self, serializer):
        """PHASE 1: Only warden+ can create fines. Students are blocked at permission level."""
        user = self.request.user
        if user.role == 'student' or (user.role == 'hr' and not user_is_top_level_management(user)):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only Wardens and Admins can create disciplinary actions.")
        college = getattr(user, 'college', None)
        save_kwargs = {'college': college} if college is not None else {}
        serializer.save(**save_kwargs)

