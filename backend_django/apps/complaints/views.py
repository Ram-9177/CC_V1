from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch
from .models import Complaint
from .serializers import ComplaintSerializer
from core.permissions import IsStaff, IsStudent
from core.role_scopes import get_warden_building_ids, user_is_top_level_management
from apps.rooms.models import RoomAllocation

class ComplaintViewSet(viewsets.ModelViewSet):
    """ViewSet for managing complaints."""
    serializer_class = ComplaintSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'severity', 'category', 'is_overdue']
    search_fields = ['title', 'description', 'student__username', 'student__registration_number']
    ordering_fields = ['created_at', 'status', 'severity']

    def get_queryset(self):
        user = self.request.user
        queryset = Complaint.objects.select_related('student').prefetch_related(
            Prefetch(
                'student__room_allocations',
                queryset=RoomAllocation.objects.filter(end_date__isnull=True).select_related('room'),
                to_attr='active_allocation'
            )
        ).all()

        # 1. Super Admin, Admin, Head Warden see ALL
        if user_is_top_level_management(user):
            return queryset

        # 2. Warden: See complaints from students in their assigned blocks
        # Assumption: Warden is allocated a room in the block they manage.
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            
            if warden_buildings.exists():
                return queryset.filter(
                    student__room_allocations__room__building_id__in=warden_buildings,
                    student__room_allocations__end_date__isnull=True
                ).distinct()
            return queryset # Fallback: Unassigned wardens see all

        # 3. Staff: See only complaints assigned to them
        if user.role == 'staff':
            return queryset.filter(assigned_to=user)

        # 4. Chef: Strictly NO access to complaints
        if user.role == 'chef':
            return queryset.none()

        # 5. Student HR: View complaints from their floor + own
        if user.groups.filter(name='Student_HR').exists():
            my_floors = RoomAllocation.objects.filter(
                student=user, end_date__isnull=True
            ).values_list('room__floor', flat=True)
            
            if my_floors:
                return queryset.filter(
                    Q(student__room_allocations__room__floor__in=my_floors) | Q(student=user),
                    student__room_allocations__end_date__isnull=True
                ).distinct()

        # 6. Regular Student: Strict Own Access
        return queryset.filter(student=user)

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
             return [permissions.IsAuthenticated(), permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]
