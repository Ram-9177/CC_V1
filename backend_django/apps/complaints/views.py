from rest_framework import viewsets, permissions, filters, status as http_status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch
from django.core.cache import cache
from .models import Complaint
from .serializers import ComplaintSerializer
from core.permissions import IsStaff, IsStudent, IsWarden, IsAdmin
from core.role_scopes import get_warden_building_ids, user_is_top_level_management
from apps.rooms.models import RoomAllocation

# Cache key for warden toggle: allow students to create complaints
STUDENT_COMPLAINTS_TOGGLE_KEY = 'allow_student_complaints'


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
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            
            if warden_buildings.exists():
                return queryset.filter(
                    student__room_allocations__room__building_id__in=warden_buildings,
                    student__room_allocations__end_date__isnull=True
                ).distinct()
            return queryset  # Fallback: Unassigned wardens see all

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
        user = self.request.user
        
        # HR and Student HR can always create complaints
        is_hr = user.role == 'hr' or getattr(user, 'is_student_hr', False) or user.groups.filter(name='Student_HR').exists()
        
        if is_hr or user_is_top_level_management(user) or user.role in ('warden', 'staff'):
            serializer.save(student=user)
            return
        
        # Regular students: check if warden toggle allows student complaints
        if user.role == 'student':
            allow_student_complaints = cache.get(STUDENT_COMPLAINTS_TOGGLE_KEY, True)
            if not allow_student_complaints:
                raise PermissionDenied("Contact HR to raise complaint.")
            serializer.save(student=user)
            return
        
        raise PermissionDenied("You do not have permission to create complaints.")

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['post'], permission_classes=[IsWarden | IsAdmin])
    def toggle_student_complaints(self, request):
        """Warden toggle: Allow/disallow students to create complaints directly."""
        current = cache.get(STUDENT_COMPLAINTS_TOGGLE_KEY, True)
        new_value = not current
        cache.set(STUDENT_COMPLAINTS_TOGGLE_KEY, new_value, timeout=None)  # Persistent
        return Response({
            'allow_student_complaints': new_value,
            'message': f"Student complaints {'enabled' if new_value else 'disabled'}."
        })

    @action(detail=False, methods=['get'])
    def complaint_settings(self, request):
        """Check if student complaints are currently allowed."""
        return Response({
            'allow_student_complaints': cache.get(STUDENT_COMPLAINTS_TOGGLE_KEY, True)
        })

    def perform_update(self, serializer):
        complaint = self.get_object()
        user = self.request.user

        if not (
            complaint.student == user
            or user_is_top_level_management(user)
            or user.role in {"warden", "staff"}
        ):
            raise PermissionDenied("You do not have permission to update this complaint.")

        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user

        if not (
            instance.student == user
            or user_is_top_level_management(user)
            or user.role in {"warden", "staff"}
        ):
            raise PermissionDenied("You do not have permission to delete this complaint.")

        instance.delete()

