from __future__ import annotations

from rest_framework import viewsets, permissions, status as http_status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch
from django.core.cache import cache

from .models import Complaint
from .serializers import ComplaintSerializer
from core.permissions import IsWarden, IsAdmin
from core.role_scopes import user_is_top_level_management, get_warden_building_ids
from core.college_mixin import CollegeScopeMixin
from apps.rooms.models import RoomAllocation
from core.cache_keys import complaints_student_toggle
from core.audit import log_action
from .assignment import auto_assign_complaint
from core.state_machine import ComplaintMachine
from core.models import IdempotencyKey

STUDENT_COMPLAINTS_TOGGLE_KEY = complaints_student_toggle()


class ComplaintViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for managing complaints."""
    queryset = Complaint.objects.all()
    serializer_class = ComplaintSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'severity', 'category']
    search_fields = ['title', 'description', 'student__username', 'student__registration_number']
    ordering_fields = ['created_at', 'status', 'severity']

    def get_queryset(self):
        user = self.request.user
        from django.db.models import Case, When, IntegerField

        # Apply college scoping first via mixin
        base_qs = super().get_queryset()
        
        queryset = base_qs.select_related('student').prefetch_related(
            Prefetch(
                'student__room_allocations',
                queryset=RoomAllocation.objects.filter(end_date__isnull=True).select_related('room'),
                to_attr='active_allocation'
            )
        ).annotate(
            priority_order=Case(
                When(severity='critical', then=1),
                When(severity='high', then=2),
                When(severity='medium', then=3),
                When(severity='low', then=4),
                default=5,
                output_field=IntegerField(),
            )
        )

        # Default ordering: Priority first, then newest
        queryset = queryset.order_by('priority_order', '-created_at')

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

        # 6. Regular Student: Strict Own Access
        return queryset.filter(student=user)

    def perform_create(self, serializer):
        user = self.request.user
        college = getattr(user, 'college', None)
        college_kwargs = {'college': college} if college is not None else {}
        
        # 1. HR always empowered to raise complaints
        if user.role == 'hr' or getattr(user, 'is_student_hr', False):
            complaint = serializer.save(**college_kwargs)
            log_action(user, 'CREATE', complaint)
            emit_complaint_event('complaint.created', complaint)
            auto_assign_complaint(complaint, actor=user)
            return
            
        # 2. Administrative & Security Authority (Admin, Head Warden, Warden)
        privileged_roles = ['admin', 'super_admin', 'head_warden', 'warden']
        if user.role in privileged_roles or user.is_superuser:
            complaint = serializer.save(**college_kwargs)
            log_action(user, 'CREATE', complaint)
            emit_complaint_event('complaint.created', complaint)
            auto_assign_complaint(complaint, actor=user)
            return

        # 3. Regular students: enforce building-scoped toggle only
        if user.role == 'student':
            from apps.rooms.models import RoomAllocation
            alloc = RoomAllocation.objects.filter(student=user, end_date__isnull=True).select_related('room__building').first()

            # No active allocation means no building scope; default deny.
            if not (alloc and alloc.room and alloc.room.building):
                raise PermissionDenied("Student complaints are currently disabled.")

            allowed = alloc.room.building.allow_student_complaints

            if not allowed:
                raise PermissionDenied("Student complaints are currently disabled.")
            
            complaint = serializer.save(student=user, **college_kwargs)
            log_action(user, 'CREATE', complaint)
            emit_complaint_event('complaint.created', complaint, user_id=user.id)
            auto_assign_complaint(complaint, actor=user)
            return
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
            else:
                # Students without active allocation should not infer global allow.
                allow = False
        
        return Response({
            'allow_student_complaints': allow
        })

    def create(self, request, *args, **kwargs):
        """Override create to support idempotency."""
        user = request.user
        idem_key = request.headers.get("Idempotency-Key")
        if idem_key:
            cached, is_new = IdempotencyKey.objects.get_or_create_response(idem_key, user.id)
            if not is_new:
                return Response(cached, status=status.HTTP_200_OK)

        response = super().create(request, *args, **kwargs)

        if idem_key:
            IdempotencyKey.objects.mark_done(idem_key, user.id, response.data)
        return response

    def update(self, request, *args, **kwargs):
        """Override update to support idempotency and state machine validation."""
        user = request.user
        idem_key = request.headers.get("Idempotency-Key")
        if idem_key:
            cached, is_new = IdempotencyKey.objects.get_or_create_response(idem_key, user.id)
            if not is_new:
                return Response(cached, status=status.HTTP_200_OK)

        response = super().update(request, *args, **kwargs)

        if idem_key:
            IdempotencyKey.objects.mark_done(idem_key, user.id, response.data)
        return response

    def perform_update(self, serializer):
        complaint = self.get_object()
        user = self.request.user

        if not (
            complaint.student == user
            or user_is_top_level_management(user)
            or user.role in {"warden", "staff"}
        ):
            raise PermissionDenied("You do not have permission to update this complaint.")

        new_status = serializer.validated_data.get('status')
        if new_status and new_status != complaint.status:
            # State machine validation
            ComplaintMachine.validate(complaint.status, new_status)

        old_status = complaint.status
        updated = serializer.save()

        # Audit: track status transitions
        new_status = updated.status
        changes = {'status': [old_status, new_status]} if old_status != new_status else {}
        log_action(user, 'UPDATE', updated, changes=changes)

        # Emit structured event on resolution
        if new_status == 'resolved' and old_status != 'resolved':
            emit_complaint_event('complaint.resolved', updated, user_id=complaint.student_id)

    def perform_destroy(self, instance):
        user = self.request.user

        if not (
            instance.student == user
            or user_is_top_level_management(user)
            or user.role in {"warden", "staff"}
        ):
            raise PermissionDenied("You do not have permission to delete this complaint.")

        log_action(user, 'DELETE', instance)
        instance.delete()
