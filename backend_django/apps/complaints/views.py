from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch
from .models import Complaint
from .serializers import ComplaintSerializer
from core.permissions import IsStaff, IsStudent
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

        # Staff/Admin see ALL complaints (must check BEFORE StudentHR since IsStudentHR also grants admin)
        if user.role in ['admin', 'super_admin', 'warden', 'head_warden', 'staff']:
            return queryset

        # Chef sees only food-related complaints
        if user.role == 'chef':
            return queryset.filter(category__in=['food', 'mess', 'dining'])

        # Student HR Logic: View complaints from their floor + own
        if user.groups.filter(name='Student_HR').exists():
            my_floors = RoomAllocation.objects.filter(
                student=user, end_date__isnull=True
            ).values_list('room__floor', flat=True)
            
            if my_floors:
                # Merge efficiently
                return queryset.filter(
                    Q(student__room_allocations__room__floor__in=my_floors) | Q(student=user),
                    student__room_allocations__end_date__isnull=True
                ).distinct()

        # Regular students see only their own
        return queryset.filter(student=user)

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update']:
             return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]
