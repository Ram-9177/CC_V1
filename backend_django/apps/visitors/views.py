from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import VisitorLog
from .serializers import VisitorLogSerializer
from core.permissions import IsGateSecurity, IsAdmin, IsWarden
from core.role_scopes import get_warden_building_ids, user_is_top_level_management

class VisitorLogViewSet(viewsets.ModelViewSet):
    """ViewSet for managing visitor logs."""
    serializer_class = VisitorLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'relationship']
    search_fields = ['visitor_name', 'student__username', 'student__registration_number', 'phone_number']
    ordering_fields = ['check_in', 'check_out']

    def get_queryset(self):
        user = self.request.user
        qs = VisitorLog.objects.all()
        
        # Admin, Super Admin, Head Warden, Gate Security see all
        if user_is_top_level_management(user) or user.role in ['gate_security', 'security_head']:
            return qs
        
        # Warden: See visitors for students in assigned building(s)
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            
            if not warden_buildings.exists():
                return qs  # Fail-safe: unassigned wardens see all
            
            return qs.filter(
                student__room_allocations__room__building_id__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).distinct()
        
        # Students see their own visitors
        if user.role == 'student':
            return qs.filter(student=user)
        
        return qs.none()

    def get_permissions(self):
        # Gate Security + Wardens + Admins can manage
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsGateSecurity() | IsWarden() | IsAdmin()]
        return [IsAuthenticated()]

    @action(detail=True, methods=['post'])
    def checkout(self, request, pk=None):
        """Mark visitor as checked out."""
        visitor = self.get_object()
        if visitor.check_out:
             return Response({'error': 'Already checked out'}, status=400)
        
        visitor.check_out = timezone.now()
        visitor.is_active = False
        visitor.save()
        return Response(self.get_serializer(visitor).data)
