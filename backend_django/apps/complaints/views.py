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
from core.cache_keys import complaints_student_toggle as _complaints_toggle_key_fn
STUDENT_COMPLAINTS_TOGGLE_KEY = _complaints_toggle_key_fn()


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
            
            if warden_buildings:
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
        if getattr(user, 'is_student_hr', False):
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
        
        # 1. HR always empowered to raise complaints
        if user.role == 'hr' or getattr(user, 'is_student_hr', False):
            serializer.save()
            return
            
        # 2. Administrative & Security Authority (Admin, Head Warden, Warden)
        privileged_roles = ['admin', 'super_admin', 'head_warden', 'warden']
        if user.role in privileged_roles or user.is_superuser:
            serializer.save()
            return

        # 3. Regular students: check the toggle for their building/block
        if user.role == 'student':
            from apps.rooms.models import RoomAllocation
            alloc = RoomAllocation.objects.filter(student=user, end_date__isnull=True).select_related('room__building').first()
            
            allowed = False
            if alloc and alloc.room and alloc.room.building:
                allowed = alloc.room.building.allow_student_complaints
            else:
                # Fallback to global cache for unallocated students
                allowed = cache.get(STUDENT_COMPLAINTS_TOGGLE_KEY, False)

            if not allowed:
                raise PermissionDenied("Student complaints are currently disabled.")
            
            serializer.save(student=user)
            return
        
        # 4. Fallback for all other roles (Chef, etc.)
        raise PermissionDenied("Contact HR to raise complaint.")

    def get_permissions(self):
        return [permissions.IsAuthenticated()]

    @action(detail=False, methods=['post'], permission_classes=[IsWarden | IsAdmin])
    def toggle_student_complaints(self, request):
        """Warden toggle: Allow/disallow students to create complaints for a specific block."""
        building_id = request.data.get('building_id')
        if not building_id:
             return Response({'error': 'building_id is required'}, status=http_status.HTTP_400_BAD_REQUEST)
             
        from apps.rooms.models import Building
        try:
            building = Building.objects.get(id=building_id)
            building.allow_student_complaints = not building.allow_student_complaints
            building.save()
            
            # Sync global cache for unallocated fallbacks
            cache.set(STUDENT_COMPLAINTS_TOGGLE_KEY, building.allow_student_complaints, timeout=None)
            
            return Response({
                'building_id': building.id,
                'allow_student_complaints': building.allow_student_complaints,
                'message': f"Student complaints {'enabled' if building.allow_student_complaints else 'disabled'} for {building.name}."
            })
        except Building.DoesNotExist:
            return Response({'error': 'Building not found'}, status=http_status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['get'])
    def complaint_settings(self, request):
        """Check if student complaints are currently allowed."""
        user = request.user
        allow = cache.get(STUDENT_COMPLAINTS_TOGGLE_KEY, False)
        
        # If student, check their building specifically
        if user.role == 'student':
            from apps.rooms.models import RoomAllocation
            alloc = RoomAllocation.objects.filter(student=user, end_date__isnull=True).select_related('room__building').first()
            if alloc and alloc.room and alloc.room.building:
                allow = alloc.room.building.allow_student_complaints
        
        return Response({
            'allow_student_complaints': allow
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

