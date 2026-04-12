"""Views for Leave Application system."""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Q

from .models import LeaveApplication
from .serializers import LeaveApplicationSerializer
from .services import LeaveApplicationService
from core.permissions import IsStaff, IsStudent, IsAdmin, IsWarden
from core.role_scopes import get_warden_building_ids, user_is_top_level_management
from core.college_mixin import CollegeScopeMixin
from core.throttles import ActionScopedThrottleMixin
from websockets.broadcast import broadcast_to_updates_user
from apps.notifications.service import NotificationService
import logging

logger = logging.getLogger(__name__)


class LeaveApplicationViewSet(ActionScopedThrottleMixin, CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for Leave Application management.
    
    - Students: create, view own, cancel own
    - Wardens: view building students' leaves, approve/reject
    - Admins/Head Wardens: view all, approve/reject
    """
    queryset = LeaveApplication.objects.all()
    serializer_class = LeaveApplicationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'leave_type', 'student']
    search_fields = ['student__username', 'student__registration_number', 'reason', 'destination']
    ordering_fields = ['start_date', 'end_date', 'created_at', 'status']
    from core.pagination import StandardPagination
    pagination_class = StandardPagination
    action_throttle_scopes = {'create': 'leave_create'}

    def get_permissions(self):
        if self.action == 'create':
            return [IsAuthenticated(), IsStudent()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user

        # STRICT ISOLATION: A student can ONLY ever see their own leaves.
        if user.role == 'student':
            # Do not depend on college scoping for self-history visibility.
            # Ownership filter is already strict isolation for students.
            return LeaveApplication.objects.select_related('student', 'approved_by').filter(student=user)

        # Apply college scoping via mixin first
        base_qs = super().get_queryset()
        qs = base_qs.select_related('student', 'approved_by')

        # Top-level management sees all
        if user_is_top_level_management(user):
            return qs

        # Wardens, HR, and Student HR see leaves for students in their assigned buildings/floors
        if user.role in ['warden', 'hr'] or getattr(user, 'is_student_hr', False):
            from core.role_scopes import get_hr_building_ids, get_hr_floor_numbers
            from django.db.models import Q
            
            assigned_buildings = get_hr_building_ids(user)
            assigned_floors = get_hr_floor_numbers(user)
            
            filter_q = Q(student__room_allocations__room__building_id__in=assigned_buildings)
            filter_q &= Q(student__room_allocations__end_date__isnull=True)
            
            if assigned_floors:
                filter_q &= Q(student__room_allocations__room__floor__in=assigned_floors)
                
            return qs.filter(filter_q).distinct()

        # Staff see all
        if user.role == 'staff':
            return qs

        return qs.none()

    def perform_create(self, serializer):
        """Students create leave for themselves."""
        LeaveApplicationService.submit_application(serializer, self.request.user)

    def perform_update(self, serializer):
        """Only allow students to update their own pending leaves."""
        instance = self.get_object()
        user = self.request.user

        if user.role == 'student':
            if instance.student != user:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('You can only edit your own leave applications.')
            if instance.status != 'pending':
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'detail': 'You can only edit pending leave applications.'})

        serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsWarden | IsAdmin])
    def approve(self, request, pk=None):
        """Approve a leave application."""
        leave = self.get_object()
        leave_status = (leave.status or '').upper()
        if leave_status != 'PENDING_APPROVAL':
            return Response(
                {'detail': f'Cannot approve a {leave.status} leave application.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        LeaveApplicationService.approve_application(
            leave,
            request.user,
            notes=request.data.get('notes', leave.notes),
        )

        return Response(self.get_serializer(leave).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsWarden | IsAdmin])
    def reject(self, request, pk=None):
        """Reject a leave application."""
        leave = self.get_object()
        leave_status = (leave.status or '').upper()
        if leave_status != 'PENDING_APPROVAL':
            return Response(
                {'detail': f'Cannot reject a {leave.status} leave application.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reason = request.data.get('reason', '')
        if not reason:
            return Response(
                {'detail': 'Rejection reason is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        leave.status = 'REJECTED'
        leave.approved_by = request.user
        leave.approved_at = timezone.now()
        leave.rejection_reason = reason
        leave.save(update_fields=['status', 'approved_by', 'approved_at', 'rejection_reason'])

        # Auto-reject Gate Pass is not needed anymore as we don't create pending gate passes for leaves.

        # Parent Notification Hook
        from apps.notifications.parent_notifier import notify_parent_leave_rejected
        notify_parent_leave_rejected(leave)

        # Notify student (WebSocket + Persistent)
        try:
            broadcast_to_updates_user(leave.student_id, 'leave_rejected', {
                'leave_id': leave.id,
                'leave_type': leave.leave_type,
                'reason': reason,
                'resource': 'leave',
            })
            
            # Persistent in-app + web push notification
            leave_type_label = dict(LeaveApplication.LEAVE_TYPE_CHOICES).get(leave.leave_type, leave.leave_type)
            NotificationService.send(
                user=leave.student,
                title='Leave Rejected ❌',
                message=f'Your {leave_type_label} request has been rejected. Reason: {reason}',
                notif_type='alert',
                action_url='/leaves'
            )
            # Real-time forecast update
            from core.services import broadcast_forecast_refresh
            broadcast_forecast_refresh(leave.start_date)
        except Exception as e:
            logger.error(f"Failed to send leave rejection notifications: {e}")

        return Response(self.get_serializer(leave).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def cancel(self, request, pk=None):
        """Student cancels their own leave application."""
        leave = self.get_object()

        if leave.student != request.user:
            return Response(
                {'detail': 'You can only cancel your own leave applications.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if leave.status not in ('PENDING_APPROVAL', 'APPROVED', 'pending', 'approved'):
            return Response(
                {'detail': f'Cannot cancel a {leave.status} leave application.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        leave.status = 'CANCELLED'
        leave.save(update_fields=['status'])

        # Real-time forecast update
        try:
            from core.services import broadcast_forecast_refresh
            broadcast_forecast_refresh(leave.start_date)
            if leave.end_date != leave.start_date:
                broadcast_forecast_refresh(leave.end_date)
        except Exception as e:
            logger.error(f"Failed to refresh forecast on cancel: {e}")

        return Response(self.get_serializer(leave).data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_active(self, request):
        """Return the student's currently active/approved leaves."""
        today = timezone.now().date()
        leaves = LeaveApplication.objects.filter(
            student=request.user,
            status__in=['APPROVED', 'ACTIVE', 'approved'],
            start_date__lte=today,
            end_date__gte=today,
        )
        serializer = self.get_serializer(leaves, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def stats(self, request):
        """Leave statistics for the dashboard."""
        user = request.user
        qs = self.get_queryset()

        today = timezone.now().date()
        total = qs.count()
        pending = qs.filter(status__in=['PENDING_APPROVAL', 'pending']).count()
        approved = qs.filter(status__in=['APPROVED', 'approved']).count()
        rejected = qs.filter(status__in=['REJECTED', 'rejected']).count()
        currently_on_leave = qs.filter(
            status='ACTIVE', start_date__lte=today, end_date__gte=today
        ).count() or qs.filter(status__in=['APPROVED', 'approved'], start_date__lte=today, end_date__gte=today).count()

        return Response({
            'total': total,
            'pending': pending,
            'approved': approved,
            'rejected': rejected,
            'currently_on_leave': currently_on_leave,
        })
