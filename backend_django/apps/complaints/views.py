from __future__ import annotations

from rest_framework import viewsets, permissions, status as http_status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Q, Prefetch, Case, When, IntegerField
from django.utils import timezone
from django.core.cache import cache
import logging

from .models import Complaint, ComplaintUpdate
from .serializers import ComplaintSerializer
from core.permissions import IsWarden, IsAdmin
from core.role_scopes import (
    user_is_top_level_management,
    get_warden_building_ids,
    get_hr_building_ids,
    get_hr_floor_numbers,
)
from core.college_mixin import CollegeScopeMixin
from apps.rooms.models import RoomAllocation
from core.audit import log_action
from .assignment import auto_assign_complaint
from core.state_machine import ComplaintMachine
from core.throttles import ActionScopedThrottleMixin


logger = logging.getLogger(__name__)

class ComplaintViewSet(ActionScopedThrottleMixin, CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for managing complaints with Phase 4 SLA & operational rules."""
    queryset = Complaint.objects.all()
    serializer_class = ComplaintSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'category', 'student_type', 'is_overdue', 'preferred_visit_slot']
    search_fields = [
        'title',
        'description',
        'student__username',
        'student__registration_number',
        'subcategory',
        'location_details',
        'contact_number',
    ]
    ordering_fields = ['created_at', 'status', 'priority', 'expected_resolution_time']
    from core.pagination import StandardPagination
    pagination_class = StandardPagination
    action_throttle_scopes = {'create': 'complaint_create'}

    def _student_scope_q(self, user) -> Q:
        active_alloc_q = Q(
            student__room_allocations__status='approved',
            student__room_allocations__end_date__isnull=True,
        )

        if user.role == 'warden':
            building_ids = get_warden_building_ids(user)
            if not building_ids:
                return Q(pk__in=[])
            return active_alloc_q & Q(student__room_allocations__room__building_id__in=building_ids)

        if user.role == 'hr' or getattr(user, 'is_student_hr', False):
            building_ids = get_hr_building_ids(user)
            if not building_ids:
                return Q(pk__in=[])
            scoped_q = active_alloc_q & Q(student__room_allocations__room__building_id__in=building_ids)
            floor_numbers = get_hr_floor_numbers(user)
            if floor_numbers:
                scoped_q &= Q(student__room_allocations__room__floor__in=floor_numbers)
            return scoped_q

        return Q(pk__in=[])

    def _user_has_student_scope(self, user, student) -> bool:
        if not student:
            return False
        if user_is_top_level_management(user):
            return True
        if getattr(student, 'id', None) == getattr(user, 'id', None):
            return True

        scoped_qs = RoomAllocation.objects.filter(
            student=student,
            status='approved',
            end_date__isnull=True,
        )

        if user.role == 'warden':
            building_ids = get_warden_building_ids(user)
            return bool(building_ids) and scoped_qs.filter(room__building_id__in=building_ids).exists()

        if user.role == 'hr' or getattr(user, 'is_student_hr', False):
            building_ids = get_hr_building_ids(user)
            if not building_ids:
                return False
            scoped_qs = scoped_qs.filter(room__building_id__in=building_ids)
            floor_numbers = get_hr_floor_numbers(user)
            if floor_numbers:
                scoped_qs = scoped_qs.filter(room__floor__in=floor_numbers)
            return scoped_qs.exists()

        return False

    def _is_assigned_staff_actor(self, user, complaint: Complaint) -> bool:
        if user.role in {'staff', 'chef', 'head_chef', 'hod', 'faculty'}:
            return complaint.assigned_to_id == user.id
        return False

    def _can_act_on_complaint(self, user, complaint: Complaint, *, include_student_owner: bool) -> bool:
        if include_student_owner and complaint.student_id == user.id:
            return True
        if user_is_top_level_management(user):
            return True
        if complaint.assigned_to_id == user.id:
            return True
        if self._user_has_student_scope(user, complaint.student):
            return True
        if self._is_assigned_staff_actor(user, complaint):
            return True
        return False

    def _can_update_complaint(self, user, complaint: Complaint) -> bool:
        return self._can_act_on_complaint(user, complaint, include_student_owner=True)

    def _can_manage_workflow(self, user, complaint: Complaint) -> bool:
        return self._can_act_on_complaint(user, complaint, include_student_owner=False)

    def get_queryset(self):
        user = self.request.user
        
        # STRICT ISOLATION: A student can ONLY ever see their own complaints.
        if user.role == 'student':
            return super().get_queryset().filter(student=user).order_by('priority', '-created_at')
        
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
                When(priority='1', then=1),
                When(priority='2', then=2),
                When(priority='3', then=3),
                When(priority='4', then=4),
                default=5,
                output_field=IntegerField(),
            )
        )

        queryset = queryset.order_by('priority_order', '-created_at')

        # 1. Management see ALL
        if user_is_top_level_management(user):
            return queryset

        # 2. Warden: See complaints from students in their assigned blocks OR assigned to them
        if user.role == 'warden':
            return queryset.filter(
                self._student_scope_q(user) |
                Q(assigned_to=user)
            ).distinct()

        if user.role == 'hr' or getattr(user, 'is_student_hr', False):
            return queryset.filter(
                self._student_scope_q(user) |
                Q(assigned_to=user)
            ).distinct()

        # 3. Staff/Chef/Faculty/HOD: See only complaints assigned to them
        if user.role in ['staff', 'chef', 'head_chef', 'hod', 'faculty']:
            return queryset.filter(assigned_to=user)

        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        college = getattr(user, 'college', None)
        target_student = serializer.validated_data.get('student') or user

        if user.role != 'student':
            raise PermissionDenied("Only student users can raise complaints.")
        if getattr(target_student, 'id', None) != getattr(user, 'id', None):
            raise PermissionDenied("You can only raise complaints for yourself in this phase.")
        
        from .services.complaint_service import ComplaintService
        complaint = ComplaintService.create_complaint(
            student=target_student,
            data=serializer.validated_data,
            college=college
        )
        
        # Manually set the ID on the serializer for the response
        serializer.instance = complaint

    def perform_update(self, serializer):
        complaint = self.get_object()
        user = self.request.user

        if not self._can_update_complaint(user, complaint):
            raise PermissionDenied("You do not have permission to update this complaint.")

        old_status = complaint.status
        updated = serializer.save()
        requested_status = updated.status
        final_status = requested_status

        if old_status != requested_status:
            # State machine validation
            ComplaintMachine.validate(old_status, requested_status)
            
            # Log to History (ComplaintUpdate)
            comment = self.request.data.get('comment', 'Status updated.')
            ComplaintUpdate.objects.create(
                complaint=updated,
                user=user,
                status_from=old_status,
                status_to=requested_status,
                comment=comment,
                is_internal=self.request.data.get('is_internal', False)
            )

            if self._auto_close_if_resolved(updated, user):
                final_status = updated.status

            # Audit & Real-time Events
            log_action(user, 'UPDATE', updated, changes={'status': [old_status, final_status]})
            
            from core.event_service import emit_event_on_commit
            if requested_status == 'resolved':
                 emit_event_on_commit('complaint.resolved', {
                     'id': updated.id,
                     'student': updated.student.username,
                     'category': updated.category
                 }, user_id=updated.student_id)

            # Keep notifications aligned for direct PUT/PATCH flows as well.
            self._notify_student_on_status_change(updated, requested_status)

    def _notify_student_on_status_change(self, complaint: Complaint, new_status: str, escalation_target=None):
        """Send student-facing status notifications for complaint workflow actions."""
        try:
            from apps.notifications.utils import notify_user

            action_url = f"/complaints?id={complaint.id}"
            target_name = None
            if escalation_target is not None:
                target_name = escalation_target.get_full_name() or escalation_target.username

            if new_status == 'resolved':
                notify_user(
                    complaint.student,
                    'Complaint Resolved ✅',
                    (
                        f"Your complaint '{complaint.title}' was marked as resolved. "
                        "Please review and close it, or reopen if the issue persists."
                    ),
                    notification_type='info',
                    action_url=action_url,
                    college=complaint.college,
                )
            elif new_status == 'invalid':
                notify_user(
                    complaint.student,
                    'Complaint Marked Invalid',
                    (
                        f"Your complaint '{complaint.title}' was marked as invalid by management. "
                        "Contact the hostel office if this looks incorrect."
                    ),
                    notification_type='warning',
                    action_url=action_url,
                    college=complaint.college,
                )
            elif new_status == 'procurement':
                notify_user(
                    complaint.student,
                    'Complaint Update',
                    f"Your complaint '{complaint.title}' is pending procurement of materials.",
                    notification_type='info',
                    action_url=action_url,
                    college=complaint.college,
                )
            elif new_status == 'closed':
                notify_user(
                    complaint.student,
                    'Complaint Closed',
                    f"Your complaint '{complaint.title}' has been closed.",
                    notification_type='info',
                    action_url=action_url,
                    college=complaint.college,
                )
            elif new_status == 'escalated':
                target_suffix = f" to {target_name}" if target_name else ""
                notify_user(
                    complaint.student,
                    'Complaint Escalated',
                    f"Your complaint '{complaint.title}' has been escalated{target_suffix} for faster resolution.",
                    notification_type='warning',
                    action_url=action_url,
                    college=complaint.college,
                )
        except Exception as exc:
            logger.warning(
                "Complaint notification failed for complaint=%s status=%s: %s",
                getattr(complaint, 'id', None),
                new_status,
                exc,
            )

    def _auto_close_if_resolved(self, complaint: Complaint, actor) -> bool:
        """Auto-close a resolved complaint to keep terminal state consistent."""
        if complaint.status != 'resolved':
            return False

        ComplaintMachine.validate('resolved', 'closed')
        complaint.status = 'closed'
        complaint.save(update_fields=['status', 'updated_at'])
        ComplaintUpdate.objects.create(
            complaint=complaint,
            user=actor,
            status_from='resolved',
            status_to='closed',
            comment='Auto-closed after resolution. Student can reopen if issue persists.'
        )
        return True

    from core.decorators import idempotent_route

    @idempotent_route()
    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Phase 4 Official Status Transition with History Logging."""
        complaint = self.get_object()
        if not self._can_manage_workflow(request.user, complaint):
            raise PermissionDenied("You do not have permission to change this complaint status.")

        new_status = request.data.get('status')
        comment = request.data.get('comment', '')

        if not new_status:
            return Response({'error': 'status is required'}, status=http_status.HTTP_400_BAD_REQUEST)

        if new_status == 'invalid' and not str(comment).strip():
            return Response(
                {'error': 'comment is required when marking a complaint invalid.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        ComplaintMachine.validate(complaint.status, new_status)

        old_status = complaint.status
        complaint.status = new_status
        if new_status == 'resolved':
            complaint.resolved_at = timezone.now()
        elif new_status == 'reopened':
            complaint.resolved_at = None
        complaint.save()

        ComplaintUpdate.objects.create(
            complaint=complaint,
            user=request.user,
            status_from=old_status,
            status_to=new_status,
            comment=comment or f"Status changed to {new_status}"
        )

        # Keep resolved complaints in resolved state; student can close/reopen via feedback flow.
        self._notify_student_on_status_change(complaint, new_status)

        return Response(self.get_serializer(complaint).data)

    @idempotent_route()
    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        """Manually escalate to next authority level."""
        complaint = self.get_object()
        if not self._can_manage_workflow(request.user, complaint):
            raise PermissionDenied("You do not have permission to escalate this complaint.")

        if complaint.escalation_level >= 3:
            return Response(
                {'detail': 'Maximum escalation level reached.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if complaint.status in ['closed', 'invalid']:
            return Response(
                {'detail': f"Cannot escalate a complaint in {complaint.status} state."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        from .services.complaint_service import ComplaintService
        escalated = ComplaintService.escalate_complaint(
            complaint_id=str(complaint.id),
            actor=request.user,
            comment=request.data.get('comment', ''),
            require_overdue=False,
        )
        if not escalated:
            complaint.refresh_from_db(fields=['escalation_level'])
            if complaint.escalation_level >= 3:
                return Response(
                    {'detail': 'Maximum escalation level reached.'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {'detail': 'No escalation target found for this level.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        complaint.refresh_from_db(fields=['assigned_to', 'escalation_level'])
        target_user = complaint.assigned_to
        if not target_user:
            return Response(
                {'detail': 'No escalation target found for this level.'},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        self._notify_student_on_status_change(complaint, 'escalated', escalation_target=target_user)

        return Response({
            'message': f"Escalated to {target_user.get_full_name() or target_user.username}",
            'escalation_level': complaint.escalation_level,
        })

    @idempotent_route()
    @action(detail=True, methods=['post'])
    def feedback(self, request, pk=None):
        """Student feedback terminal."""
        complaint = self.get_object()
        if complaint.student != request.user:
             raise PermissionDenied("Only the student who raised the complaint can provide feedback.")

        if complaint.status not in ['resolved', 'closed']:
             return Response({'error': 'Feedback is allowed only for resolved/closed complaints.'}, status=http_status.HTTP_400_BAD_REQUEST)

        previous_status = complaint.status
        action_type = request.data.get('action') # 'close' or 'reopen'
        if action_type == 'close':
            if complaint.status != 'resolved':
                return Response({'error': 'Close action is allowed only for resolved complaints.'}, status=http_status.HTTP_400_BAD_REQUEST)
            complaint.status = 'closed'
        elif action_type == 'reopen':
            complaint.status = 'reopened'
            complaint.resolved_at = None
        else:
            return Response({'error': 'Invalid feedback action (use "close" or "reopen").'}, status=http_status.HTTP_400_BAD_REQUEST)

        complaint.save()
        ComplaintUpdate.objects.create(
            complaint=complaint,
            user=request.user,
            status_from=previous_status,
            status_to=complaint.status,
            comment=request.data.get('comment', f'Student feedback: {action_type.title()}')
        )

        if action_type == 'close':
            try:
                from apps.notifications.service import NotificationService
                NotificationService.send(
                    user=complaint.student,
                    title='Complaint Closed',
                    message=f"Your complaint '{complaint.title}' has been closed.",
                    notif_type='success',
                    action_url=f"/complaints?id={complaint.id}",
                    college=complaint.college,
                )
            except Exception:
                pass

        return Response(self.get_serializer(complaint).data)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Phase 4 Operational Analytics (Optimized via Service Layer)."""
        if not user_is_top_level_management(request.user):
            raise PermissionDenied("Analytics only available for management.")
        
        college_id = str(getattr(getattr(request.user, 'college', None), 'id', 'none'))
        from .services.complaint_service import ComplaintService
        stats = ComplaintService.get_analytics(college_id)

        # Add 7-day timeline (real-time for precision in the 'God View')
        from django.db.models import Count
        from django.db.models.functions import TruncDate
        seven_days_ago = timezone.now() - timezone.timedelta(days=7)
        timeline = Complaint.objects.filter(
            college_id=college_id if college_id != 'none' else None,
            created_at__gte=seven_days_ago
        ).annotate(date=TruncDate('created_at')) \
         .values('date') \
         .annotate(count=Count('id')) \
         .order_by('date')

        stats['volume_timeline'] = timeline
        return Response(stats)

    def perform_destroy(self, instance):
        user = self.request.user
        if not (instance.student == user or user_is_top_level_management(user)):
            raise PermissionDenied("Access Denied.")
        log_action(user, 'DELETE', instance)
        instance.delete()
