# pyre-ignore-all-errors
# pyright: reportMissingImports=false
# pyright: reportMissingModuleSource=false
"""Gate passes views with enhanced security and validation."""

from rest_framework import viewsets, status  # type: ignore[import]  # pyre-ignore
from rest_framework.decorators import action  # type: ignore[import]  # pyre-ignore
from rest_framework.response import Response  # type: ignore[import]  # pyre-ignore
from rest_framework.permissions import IsAuthenticated  # type: ignore[import]  # pyre-ignore
from core.throttles import ExportRateThrottle  # type: ignore[import]  # pyre-ignore
from core.permissions import (  # type: ignore[import]  # pyre-ignore
    IsWarden, IsAdmin, IsGateSecurity,
    user_is_admin, user_is_staff, user_is_hr, ROLE_STUDENT,
    ROLE_WARDEN, ROLE_HEAD_WARDEN
)
from apps.auth.models import User  # type: ignore[import]  # pyre-ignore
from core.role_scopes import get_warden_building_ids, user_is_top_level_management  # type: ignore[import]  # pyre-ignore
from core.security import InputValidator, AuditLogger  # type: ignore[import]  # pyre-ignore
from core.errors import (  # type: ignore[import]  # pyre-ignore
    PermissionAPIError,
    api_error_response
)
from django.utils import timezone  # type: ignore[import]  # pyre-ignore
from typing import Optional
from datetime import datetime
from .models import GatePass, GateScan  # type: ignore[import]  # pyre-ignore
from .serializers import GatePassSerializer, GateScanSerializer  # type: ignore[import]  # pyre-ignore
from apps.rooms.models import RoomAllocation  # type: ignore[import]  # pyre-ignore
from django.db.models import Prefetch, Q  # type: ignore[import]  # pyre-ignore
import logging
from django.db import transaction  # type: ignore[import]  # pyre-ignore
from django.core.cache import cache  # type: ignore[import]  # pyre-ignore
from apps.notifications.service import NotificationService  # type: ignore[import]  # pyre-ignore
from core.pagination import StandardPagination  # type: ignore[import]  # pyre-ignore
from core import cache_keys as ck  # type: ignore[import]  # pyre-ignore
from core.decorators import idempotent_route  # type: ignore[import]  # pyre-ignore

# REMOVED: from apps.gate_scans.models import GateScan as GateScanLog
from core.event_service import emit_event, emit_event_on_commit  # type: ignore[import]  # pyre-ignore
# Keep broadcast_to_role for the internal forecast debounce path only
from websockets.broadcast import broadcast_to_role  # type: ignore[import]  # pyre-ignore
from core.state_machine import GatePassMachine  # type: ignore[import]  # pyre-ignore

logger = logging.getLogger(__name__)


from core.college_mixin import CollegeScopeMixin  # type: ignore[import]  # pyre-ignore

class GatePassViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for Gate Pass management with enhanced security."""

    # Manual Redis caching for list endpoint (OPTION B)
    # Cache key includes filters, user, and CACHE_VERSION from settings
    # Invalidate cache on create/update/destroy

    def _get_list_cache_key(self, request):
        """No longer used. Kept for backwards compatibility."""
        pass

    def list(self, request, *args, **kwargs):
        """List gate passes without caching to ensure filters and pagination work properly."""
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def _invalidate_list_cache(self, user_id):
        pass

    def _invalidate_pass_related_caches(self, gate_pass):
        """Invalidate caches for all involved parties and global metrics."""
        # 1. Invalidate current acting user's list cache
        if hasattr(self.request, 'user') and self.request.user.id:
            self._invalidate_list_cache(self.request.user.id)
        
        # 2. Invalidate student's caches
        if gate_pass and gate_pass.student_id:
            # Invalidate list cache
            self._invalidate_list_cache(gate_pass.student_id)
            # Invalidate student bundle metrics cache
            cache.delete(ck.student_bundle(gate_pass.student_id))

        # 3. CRITICAL: Invalidate all staff/security list caches
        # This ensures security personnel see approved passes instantly.
        try:
            if hasattr(cache, 'delete_pattern'):
                # Invalidate all gatepass lists across all users
                cache.delete_pattern("hc:gatepass:list:*")
        except Exception as e:
            logger.warning(f"Failed to perform pattern cache invalidation: {e}")

        # 4. Invalidate global metrics
        cache.delete(ck.metrics_dashboard_global())


    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        response = super().destroy(request, *args, **kwargs)
        # Invalidate both the student's and the acting staff's caches
        self._invalidate_pass_related_caches(instance)
        return response

    @action(detail=False, methods=['get'])
    def active_pass(self, request):
        """Get the current active or pending gate pass for the authenticated user to avoid 404 errors."""
        user = request.user
        
        # Only students typically have active passes queried this way
        if user.role != 'student':
            return Response(None)
            
        active_pass = GatePass.objects.filter(
            student=user,
            status__in=['pending', 'approved', 'out', 'in']
        ).select_related(
            'approved_by'
        ).order_by('-created_at').first()
        
        if not active_pass:
            return Response(None)
            
        serializer = self.get_serializer(active_pass)
        return Response(serializer.data)

    
    # optimize queryset with select_related for student profile and room allocation to fix N+1
    queryset = GatePass.objects.select_related(
        'student', 
        'student__tenant',
        'approved_by'
    ).prefetch_related('student__groups').all()
    serializer_class = GatePassSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    
    # NEW: Enable standard DRF filtering for history and status
    from django_filters.rest_framework import DjangoFilterBackend
    from rest_framework import filters
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = {
        'status': ['exact'],
        'pass_type': ['exact'],
        'student_id': ['exact'],
        'student__username': ['exact', 'icontains'], # This alias handles "hall_ticket"
    }
    search_fields = ['student__registration_number', 'student__username', 'purpose', 'destination']
    ordering_fields = ['created_at', 'exit_date', 'entry_date']
    
    def get_permissions(self):
        """Set permissions based on action with proper security."""
        if self.action in ['approve', 'reject', 'destroy']:
            # Only admins and wardens can approve/reject/delete
            return [IsAuthenticated(), (IsAdmin | IsWarden)()]
        elif self.action == 'verify':
            # ONLY gate security and security head can verify (IN/OUT)
            from core.permissions import IsSecurityPersonnel  # type: ignore[import]  # pyre-ignore
            return [IsAuthenticated(), IsSecurityPersonnel()]
        elif self.action == 'create':
            # Students and staff create passes — security roles CANNOT create
            return [IsAuthenticated()]
        elif self.action in ['list', 'retrieve']:
            # All authenticated users can list/retrieve with filtering
            return [IsAuthenticated()]
        else:
            # Default: all authenticated users
            return [IsAuthenticated()]
    
    def get_queryset(self):
        """Filter based on user role and ownership with high-performance prefetching."""
        user = self.request.user

        def with_performance_hints(qs):
            return qs.select_related(
                'student',
                'student__tenant',   # Powers risk_status, parent info
                'student__college',  # Powers college_name
                'approved_by',
            ).prefetch_related(
                'student__groups',  # Powers is_student_hr check
                # Optimized subquery for room info to avoid manual loops in serializer
                Prefetch(
                    'student__room_allocations',
                    queryset=RoomAllocation.objects.filter(
                        end_date__isnull=True
                    ).select_related('room__building__hostel'),
                    to_attr='active_allocation'
                )
            )

        # STRICT ISOLATION: students can only see their own passes.
        # Do not depend on college scoping here; self-ownership is already hard isolation.
        if user.role == 'student':
            queryset = with_performance_hints(GatePass.objects.all()).filter(student=user)
        else:
            # Use super().get_queryset() to inherit CollegeScopeMixin filters (Hard Isolation)
            queryset = with_performance_hints(super().get_queryset())

        # Search with validation
        search_ticket = self.request.query_params.get('hall_ticket', '').strip()
        if search_ticket:
            # Sanitize input
            try:
                search_ticket = InputValidator.validate_string(search_ticket, "hall_ticket", 50)
                queryset = queryset.filter(student__registration_number__icontains=search_ticket)
            except Exception as e:
                logger.warning(f"Invalid search ticket: {str(e)}")

        # Master Search (Phase 3 Requirement)
        search_query = self.request.query_params.get('search', '').strip()
        if search_query:
            try:
                sq = InputValidator.validate_string(search_query, "search", 50)
                if sq.isdigit():
                    queryset = queryset.filter(id=int(sq))
                else:
                    sq_parts = sq.split()
                    if len(sq_parts) > 1:
                        queryset = queryset.filter(
                            Q(student__registration_number__icontains=sq) |
                            Q(student__first_name__icontains=sq_parts[0], student__last_name__icontains=sq_parts[1])
                        )
                    else:
                        queryset = queryset.filter(
                            Q(student__registration_number__icontains=sq) |
                            Q(student__first_name__icontains=sq) |
                            Q(student__last_name__icontains=sq)
                        )
            except Exception as e:
                logger.warning(f"Invalid master search query: {str(e)}")

        # Status filter with validation
        status_filter = self.request.query_params.get('status', '').strip()
        if status_filter:
            try:
                allowed_statuses = [
                    'draft', 'pending', 'approved', 'rejected',
                    'out', 'outside', 'used', 'late_return',
                    'in', 'returned', 'completed', 'expired'
                ]
                status_filter = InputValidator.validate_status(status_filter, allowed_statuses)
                # Canonical status mapping so UI filters surface all legacy and current records.
                status_alias_map = {
                    'out': ['out', 'outside', 'used', 'late_return'],
                    'outside': ['out', 'outside', 'used', 'late_return'],
                    'used': ['out', 'outside', 'used', 'late_return'],
                    'in': ['in', 'returned', 'completed'],
                    'returned': ['in', 'returned', 'completed'],
                }
                mapped_statuses = status_alias_map.get(status_filter, [status_filter])
                queryset = queryset.filter(status__in=mapped_statuses)
            except Exception as e:
                logger.warning(f"Invalid status filter: {str(e)}")

        # Role-based filtering
        # Institutional Isolation: Mixin handles base filtering, but we refine for roles
        if user.role == 'student':
            return queryset.order_by('-created_at')

        if user_is_top_level_management(user):
            # top_level management can see all in THEIR college (Mixin handles this)
            return queryset.order_by('-created_at')

        if user.role in ['gate_security', 'security_head']:
            # For security dashboard/operations, default to today's passes
            # but allow search/filter to bypass the date restriction for history checks
            if search_ticket or search_query or status_filter:
                 return queryset.order_by('-created_at')
                 
            today = timezone.localdate()
            return queryset.filter(
                status__in=['approved', 'out', 'outside', 'returned', 'late_return', 'used'],
                exit_date__date=today,
            ).order_by('-created_at')
        
        if user.role == 'warden' or user_is_hr(user):
            # Scope-based access for Wardens and HR
            from core.role_scopes import get_warden_building_ids, get_hr_floor_numbers  # type: ignore[import]  # pyre-ignore
            assigned_buildings = get_warden_building_ids(user)
            assigned_floors = get_hr_floor_numbers(user)
            
            filter_q = Q(student__room_allocations__room__building_id__in=assigned_buildings)
            filter_q &= Q(student__room_allocations__end_date__isnull=True)
            
            if assigned_floors:
                filter_q &= Q(student__room_allocations__room__floor__in=assigned_floors)
                
            return queryset.filter(filter_q).distinct().order_by('-created_at')
        
        # Default: Students see only their own
        return queryset.filter(student=user).order_by('-created_at')

    @idempotent_route()
    def create(self, request, *args, **kwargs):
        """Create a gate pass with ownership validation and service-layer logic."""
        user = request.user
        data = request.data

        # Security roles cannot create gate passes — they only verify (scan IN/OUT)
        if user.role in ('gate_security', 'security_head'):
            return api_error_response(
                "Security personnel cannot create gate passes.",
                "PERMISSION_DENIED",
                403,
            )
        
        # 1. Ownership & Permission Guard
        student_id = data.get('student_id', user.id)
        if not user_is_admin(user) and str(student_id) != str(user.id):
            if user.role not in (ROLE_WARDEN, ROLE_HEAD_WARDEN):
                return api_error_response("Unauthorized", "PERMISSION_DENIED", 403)
        
        from apps.auth.models import User
        from django.shortcuts import get_object_or_404
        target_student = get_object_or_404(User, id=student_id)

        # 2. Delegate to Service Layer
        from apps.gate_passes.services.gatepass_service import GatePassService
        try:
            pass_type = data.get('pass_type') or 'day'
            if pass_type not in {'day', 'overnight', 'weekend', 'emergency', 'leave'}:
                pass_type = 'day'

            reason = (data.get('reason') or data.get('purpose') or '').strip() or 'General'
            destination = (data.get('destination') or '').strip() or 'Offsite'

            exit_date_raw = (data.get('exit_date') or '').strip()
            exit_time_raw = (data.get('exit_time') or '00:00').strip()
            if not exit_date_raw:
                return api_error_response("exit_date is required.", "VALIDATION_ERROR", 400)

            exit_dt = datetime.fromisoformat(f"{exit_date_raw}T{exit_time_raw}")
            if timezone.is_naive(exit_dt):
                exit_dt = timezone.make_aware(exit_dt, timezone.get_current_timezone())

            entry_dt = None
            expected_return_date = (data.get('expected_return_date') or '').strip()
            expected_return_time = (data.get('expected_return_time') or '00:00').strip()
            if expected_return_date:
                entry_dt = datetime.fromisoformat(f"{expected_return_date}T{expected_return_time}")
                if timezone.is_naive(entry_dt):
                    entry_dt = timezone.make_aware(entry_dt, timezone.get_current_timezone())

            service_payload = {
                'pass_type': pass_type,
                'reason': reason,
                'destination': destination,
                'exit_date': exit_dt,
                'entry_date': entry_dt,
                'audio_brief': data.get('audio_brief'),
            }

            gate_pass = GatePassService.apply_pass(
                student=target_student,
                actor=user,
                data=service_payload
            )
            serializer = self.get_serializer(gate_pass)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            return api_error_response(str(e), "SERVICE_ERROR", 400)

    @action(detail=True, methods=['post'])
    @idempotent_route()
    def security_reject(self, request, pk=None):
        """Security manual rejection at gate."""
        try:
            gate_pass = self.get_object()
            reason = request.data.get('reject_reason', '').strip()
            
            if not reason:
                return api_error_response("Reject Reason is REQUIRED.", "MISSING_REASON", 400)
                
            if gate_pass.status not in ['approved', 'pending']:
                return api_error_response(f"Cannot reject pass in {gate_pass.status} state.", "INVALID_STATE", 400)
                
            gate_pass.status = 'rejected'
            gate_pass.reject_reason = reason
            gate_pass.save(update_fields=['status', 'reject_reason'])
            
            AuditLogger.log_action(request.user.id, 'security_reject', 'gate_pass', gate_pass.id, success=True)
            return Response(self.get_serializer(gate_pass).data)
        except Exception as e:
            return api_error_response(str(e), "SECURITY_REJECT_FAILED", 400)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated, IsGateSecurity | IsAdmin])
    def live_out_list(self, request):
        """Provides the Live OUT List for Security Dashboard."""
        out_passes = self.get_queryset().filter(
            status__in=['out', 'outside', 'used', 'late_return']
        ).select_related(
            'student', 'student__tenant'
        ).order_by('-exit_time')
        
        data = []
        for p in out_passes:
            data.append({
                'id': p.id,
                'student_name': p.student.get_full_name(),
                'hall_ticket': p.student.registration_number,
                'exit_time': p.exit_time,
                'expected_return': p.entry_date,
            })
            
        return Response(data)

    @action(detail=True, methods=['post'])
    @idempotent_route()
    def mark_exit(self, request, pk=None):
        """Mark student exit via Service Layer."""
        from apps.gate_passes.services.gatepass_service import GatePassService
        try:
            gate_pass = GatePassService.mark_exit(pk, request.user)
            return Response(self.get_serializer(gate_pass).data)
        except Exception as e:
            return api_error_response(str(e), "MARK_EXIT_FAILED", 400)

    @action(detail=True, methods=['post'])
    @idempotent_route()
    def mark_entry(self, request, pk=None):
        """Mark student entry via Service Layer."""
        from apps.gate_passes.services.gatepass_service import GatePassService
        try:
            gate_pass = GatePassService.mark_entry(pk, request.user)
            return Response(self.get_serializer(gate_pass).data)
        except Exception as e:
            return api_error_response(str(e), "MARK_ENTRY_FAILED", 400)

    @action(detail=True, methods=['post'])
    @idempotent_route()
    def approve(self, request, pk=None):
        """Approve a gate pass via Service Layer."""
        from apps.gate_passes.services.gatepass_service import GatePassService
        try:
            gate_pass = GatePassService.approve_pass(pk, request.user, request.data.get('remarks', ''))
            return Response(self.get_serializer(gate_pass).data)
        except Exception as e:
            return api_error_response(str(e), "APPROVAL_FAILED", 400)

    @action(detail=True, methods=['post'])
    @idempotent_route()
    def reject(self, request, pk=None):
        """Reject a gate pass via Service Layer (warden/admin)."""
        from apps.gate_passes.services.gatepass_service import GatePassService
        try:
            remarks = request.data.get('remarks', '').strip()
            gate_pass = GatePassService.reject_pass(pk, request.user, remarks)
            return Response(self.get_serializer(gate_pass).data)
        except Exception as e:
            return api_error_response(str(e), "REJECTION_FAILED", 400)

    def perform_update(self, serializer):
        """Prevent unauthorized updates to critical fields."""
        instance = serializer.instance
        user = self.request.user
        
        # Only admins/wardens can change status
        if 'status' in serializer.validated_data and not user_is_staff(user):
            AuditLogger.log_action(user.id, 'update', 'gate_pass', instance.id, success=False)
            raise PermissionAPIError('Only staff can change pass status')
            
        # Security Hardening: Prevent students from modifying a pass once it's no longer pending
        if not user_is_staff(user) and instance.status != 'pending':
            AuditLogger.log_action(user.id, 'update_rejected', 'gate_pass', instance.id, success=False)
            raise PermissionAPIError('You cannot modify a gate pass after it has been processed. Please cancel or request a new one.')
        
        result = super().perform_update(serializer)
        # Invalidate related caches for real-time visibility
        self._invalidate_pass_related_caches(instance)
        return result


    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def security_dashboard(self, request):
        """Security Dashboard summary statistics and lists."""
        user = request.user
        if not (user_is_staff(user) or user.role == 'gate_security'):
            return api_error_response("Access denied.", "PERMISSION_DENIED", 403)

        outside = GatePass.objects.filter(movement_status='outside').select_related('student')
        late_returns = GatePass.objects.filter(status='late_return').select_related('student')
        
        today = timezone.now().date()
        today_movements = GatePass.objects.filter(
            Q(exit_time__date=today) | Q(entry_time__date=today)
        ).select_related('student', 'exit_security', 'entry_security').order_by('-exit_time', '-entry_time')

        return Response({
            'currently_outside': self.get_serializer(outside, many=True).data,
            'late_returns': self.get_serializer(late_returns, many=True).data,
            'todays_movements': self.get_serializer(today_movements, many=True).data,
            'stats': {
                'outside_count': outside.count(),
                'late_count': late_returns.count(),
                'today_total_movements': today_movements.count()
            }
        })

    def _broadcast_event(self, gate_pass: GatePass, event_type: str, extra: Optional[dict] = None):
        """Emit a structured gate pass WebSocket event via event_service."""
        try:
            payload = {
                'id': gate_pass.id,
                'status': gate_pass.status,
                'movement_status': gate_pass.movement_status,
                'approved_at': gate_pass.approved_at.isoformat() if gate_pass.approved_at else None,
                'exit_time': gate_pass.exit_time.isoformat() if gate_pass.exit_time else None,
                'entry_time': gate_pass.entry_time.isoformat() if gate_pass.entry_time else None,
                'student_id': gate_pass.student_id,
                'resource': 'gate_pass',
            }
            if extra:
                payload.update(extra)

            # Emit via structured event system (fan-out: user + management)
            emit_event(
                event_type,
                payload,
                user_id=gate_pass.student_id,
                to_management=True,
            )

            # Always ensure a generic 'gatepass_updated' is also sent for dashboard sync
            if event_type != 'gatepass_updated':
                emit_event('gatepass_updated', payload, user_id=gate_pass.student_id, to_management=True)

            # Forecast cache invalidation + chef notification (debounced)
            if event_type in ['gatepass_approved', 'gatepass_rejected', 'gatepass_canceled', 'gatepass_updated']:
                from django.core.cache import cache  # type: ignore[import]  # pyre-ignore
                from core.services import invalidate_forecast_cache  # type: ignore[import]  # pyre-ignore
                throttle_key = ck.gatepass_forecast_debounce(gate_pass.id)
                if not cache.get(throttle_key):
                    cache.set(throttle_key, True, timeout=5)  # 5-second debounce
                    exit_date = gate_pass.exit_date.date() if gate_pass.exit_date else None
                    invalidate_forecast_cache(exit_date)
                    emit_event(
                        'meal.forecast_updated',
                        {
                            'affected_student_id': gate_pass.student_id,
                            'date': str(exit_date) if exit_date else None,
                            'resource': 'forecast',
                        },
                        to_management=False,
                        to_chef=True,
                    )

        except Exception as e:
            logger.error(f"WebSocket broadcast error: {str(e)}")
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def last_scan(self, request):
        """Return the latest gate scan (in/out) for the authenticated user."""
        user = request.user
        
        scan = GateScan.objects.filter(student=user).order_by('-scan_time').first()
        if not scan:
            return Response(None, status=status.HTTP_200_OK)

        gate_pass_id = GatePass.objects.filter(qr_code=scan.qr_code).values_list('id', flat=True).first()

        return Response({
            'id': scan.id,
            'direction': scan.direction,
            'scan_time': scan.scan_time,
            'location': scan.location,
            'gate_pass_id': gate_pass_id,
        })
    

    @action(detail=True, methods=['post'])
    def mark_informed(self, request, pk=None):
        """Mark that parents have been informed and optionally approve the pass immediately."""
        try:
            # Idempotency check
            user = request.user
            idem_key = request.headers.get("Idempotency-Key")
            if idem_key:
                from core.models import IdempotencyKey  # type: ignore[import]  # pyre-ignore
                cached, is_new = IdempotencyKey.objects.get_or_create_response(
                    idem_key, user.id
                )
                if not is_new:
                    return Response(cached, status=200)

            approve = request.data.get('approve', False)
            
            if not user_is_staff(user):
                raise PermissionAPIError('Only staff can mark parents as informed')
            
            with transaction.atomic():
                gate_pass = GatePass.objects.select_for_update().get(pk=pk)
                gate_pass.parent_informed = True
                gate_pass.parent_informed_at = timezone.now()
                
                if approve:
                    # State machine validation
                    GatePassMachine.validate(gate_pass.status, 'approved')
                    
                    gate_pass.status = 'approved'
                    gate_pass.approved_by = user
                    gate_pass.approved_at = timezone.now()
                    gate_pass.movement_status = 'inside'
                    gate_pass.approval_remarks = "Approved via Parent Informed Protocol"
                
                gate_pass.save()
                
                # Invalidate related caches
                self._invalidate_pass_related_caches(gate_pass)
                
                action_name = 'mark_informed_approve' if approve else 'mark_informed'
                AuditLogger.log_action(user.id, action_name, 'gate_pass', pk, success=True)
                
                # Broadcast update based on action
                event_type = 'gatepass_approved' if approve else 'gatepass_parent_informed'
                transaction.on_commit(lambda: self._broadcast_event(gate_pass, event_type))

                if approve:
                    # Notify student and security
                    try:
                        NotificationService.send(
                            gate_pass.student,
                            'Gate Pass Approved ✅',
                            'Your gate pass has been approved after parental verification.',
                            'info',
                            '/gate-passes'
                        )
                        sec_msg = f"Gate pass approved for {gate_pass.student.get_full_name() or gate_pass.student.username} (Parent Verified)."
                        NotificationService.send_to_role('gate_security', 'Gate Pass Approved', sec_msg, 'info', '/gate-scans')
                    except Exception as e:
                        logger.warning(f"Failed to send approval notifications: {e}")
            
            serializer = self.get_serializer(gate_pass)
            response_data = serializer.data
            if idem_key:
                IdempotencyKey.objects.mark_done(idem_key, user.id, response_data)
            return Response(response_data)
        except Exception as e:
            logger.error(f"Mark Informed error: {str(e)}")
            return api_error_response(str(e), "ERROR", status_code=400)
    @action(detail=False, methods=['get'], throttle_classes=[ExportRateThrottle])
    def export_csv(self, request):
        """Export filtered gate passes to CSV using values() iterator for max memory safety.

        Heavy streaming operation.  Protected by ExportRateThrottle (2 req/min)
        so it cannot starve WebSocket workers on the free-tier server.
        """
        import csv
        from django.http import StreamingHttpResponse  # type: ignore[import]  # pyre-ignore
        
        # Verify permissions
        user = request.user
        if not (user_is_admin(user) or user.role in ['warden', 'head_warden', 'security_head']):
            return api_error_response("Not authorized to export data", "PERMISSION_DENIED", status_code=403)
        
        # Get base queryset
        queryset = self.filter_queryset(self.get_queryset())
        
        # OPTIMIZATION: Clear heavy prefetches
        queryset = queryset.select_related(None).prefetch_related(None).order_by('-created_at')[:10000]
        
        # Pre-fetch needed room info efficiently
        # Use a list of IDs - safe for 10k rows (approx 80KB RAM)
        student_ids = list(queryset.values_list('student_id', flat=True))
        
        # Fetch allocations manually to build a lightweight map
        allocations = RoomAllocation.objects.filter(
            student_id__in=student_ids, 
            end_date__isnull=True
        ).select_related('room').values('student_id', 'room__room_number')
        
        room_map = {a['student_id']: a['room__room_number'] for a in allocations}
        
        class Echo:
            def write(self, value):
                return value

        def stream_gatepasses():
            buffer = Echo()
            writer = csv.writer(buffer)
            yield writer.writerow(['ID', 'Student Name', 'Reg No', 'Room', 'Type', 'Status', 
                                 'Planned Exit', 'Planned Entry', 'Actual Exit', 'Actual Entry', 
                                 'Approved By', 'Created At'])
            
            # MEMORY SAFETY: Use values() instead of model instances
            # This reduces RAM usage from ~100MB to ~5MB for 10k rows
            data_qs = queryset.values(
                'id',
                'student__first_name', 'student__last_name', 'student__username', 'student__registration_number', 'student_id',
                'pass_type', 'status',
                'exit_date', 'entry_date', 'actual_exit_at', 'actual_entry_at',
                'approved_by__username', 'created_at'
            )
            
            for row in data_qs.iterator(chunk_size=1000):
                name = f"{row['student__first_name']} {row['student__last_name']}".strip() or row['student__username']
                room_no = room_map.get(row['student_id'], '')
                
                yield writer.writerow([
                    row['id'],
                    name,
                    row['student__registration_number'],
                    room_no,
                    row['pass_type'],
                    row['status'],
                    row['exit_date'].strftime("%Y-%m-%d %H:%M") if row['exit_date'] else '',
                    row['entry_date'].strftime("%Y-%m-%d %H:%M") if row['entry_date'] else '',
                    row['actual_exit_at'].strftime("%Y-%m-%d %H:%M") if row['actual_exit_at'] else '',
                    row['actual_entry_at'].strftime("%Y-%m-%d %H:%M") if row['actual_entry_at'] else '',
                    row['approved_by__username'] or '',
                    row['created_at'].strftime("%Y-%m-%d %H:%M"),
                ])

        response = StreamingHttpResponse(stream_gatepasses(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="gate_passes_{timezone.now().strftime("%Y%m%d_%H%M")}.csv"'
        return response
    

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """God-level scan logic for gate entry/exit by ID."""
        try:
            with transaction.atomic():
                gate_pass = GatePass.objects.select_for_update().get(pk=pk)
                user = request.user
                
                from core.permissions import ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD
                if user.role not in [ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD]:
                    raise PermissionAPIError('Only gate security personnel can verify passes')
                
                action_type = request.data.get('action', '').strip() # 'check_out' or 'check_in'
                
                if action_type == 'check_out':
                    if gate_pass.status == 'out':
                        return api_error_response("Student is already OUT.", "DOUBLE_SCAN", 400)
                    GatePassMachine.validate(gate_pass.status, 'out')
                    
                    now = timezone.now()
                    gate_pass.status = 'out'
                    gate_pass.actual_exit_at = now
                    gate_pass.exit_time = now
                    gate_pass.exit_security = user
                elif action_type == 'check_in':
                    if gate_pass.status in ['in', 'completed']:
                         return api_error_response("Student has already returned.", "DOUBLE_SCAN", 400)
                    GatePassMachine.validate(gate_pass.status, 'in')
                    
                    now = timezone.now()
                    gate_pass.status = 'in'
                    gate_pass.actual_entry_at = now
                    gate_pass.entry_time = now
                    gate_pass.entry_security = user
                    
                    if gate_pass.entry_date and now > gate_pass.entry_date:
                        diff = now - gate_pass.entry_date
                        gate_pass.late_minutes = int(diff.total_seconds() // 60)
                        student = gate_pass.student
                        student.late_count += 1
                        student.save(update_fields=['late_count'])
                        gate_pass.late_count = student.late_count
                    
                    gate_pass.status = 'completed'
                
                gate_pass.save()
                
                direction = 'out' if action_type == 'check_out' else 'in'
                GateScan.objects.create(
                    gate_pass=gate_pass,
                    student=gate_pass.student,
                    direction=direction,
                    qr_code=gate_pass.qr_code,
                    location=request.data.get('location', 'Main Gate'),
                    scan_method=request.data.get('scan_method', 'manual')
                )

                self._invalidate_pass_related_caches(gate_pass)
                event = 'gatepass_exit' if direction == 'out' else 'gatepass_entry'
                transaction.on_commit(lambda: self._broadcast_event(gate_pass, event))
                
                return Response(self.get_serializer(gate_pass).data)
        except Exception as e:
            return api_error_response(str(e), "ERROR", status_code=400)

    @action(detail=False, methods=['post'])
    def scan(self, request):
        """Unified Scan endpoint by QR code."""
        qr_code = request.data.get('qr_code', '').strip()
        location = request.data.get('location', 'Main Gate')
        
        if not qr_code:
            return api_error_response("QR Code is required.", "VALIDATION_ERROR", 400)
            
        gate_pass = GatePass.objects.filter(qr_code=qr_code).first()
        if not gate_pass:
            return api_error_response("Invalid QR Code.", "NOT_FOUND", 404)
            
        # Determine action based on current status
        if gate_pass.status == 'approved':
            action = 'check_out'
        elif gate_pass.status == 'out':
            action = 'check_in'
        elif gate_pass.status in ['in', 'completed']:
            return api_error_response("Student has already returned.", "DOUBLE_SCAN", 400)
        else:
            return api_error_response(f"Cannot scan pass with status: {gate_pass.status}", "INVALID_STATUS", 400)
            
        # Call the verify logic but bypass the detail PK requirement
        request.data['action'] = action
        request.data['location'] = location
        request.data['scan_method'] = 'qr'
        try:
            return self.verify(request, pk=gate_pass.id)
        except Exception as e:
            return api_error_response(str(e), "ERROR", status_code=400)


class GateScanViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for Gate Scan logging.
    
    # DEPRECATED: The canonical GateScan model lives in apps.gate_passes.models.
    # The active GateScanViewSet is in apps.gate_scans.views (compatibility shim).
    # This viewset is kept for backwards compatibility only.
    # Use POST /api/scan/ (UnifiedScanView) for all new QR scan operations.
    """
    
    queryset = GateScan.objects.all()
    serializer_class = GateScanSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Only gate staff and admin can create scans."""
        if self.action in ['create', 'scan_qr']:
            from core.permissions import IsSecurityPersonnel  # type: ignore[import]  # pyre-ignore
            return [IsAuthenticated(), IsSecurityPersonnel()]
        else:
            return [IsAuthenticated()]
    
    def get_queryset(self):
        """Filter based on user role with bounded prefetching for performance."""
        user = self.request.user
        
        base_qs = super().get_queryset()
        qs = base_qs.select_related(
            'student', 
            'gate_pass',
            'student__tenant'
        ).prefetch_related(
            Prefetch(
                'student__room_allocations',
                queryset=RoomAllocation.objects.filter(
                    end_date__isnull=True
                ).select_related('room'),
                to_attr='active_allocation'
            )
        ).order_by('-scan_time')

        if user_is_top_level_management(user) or user.role in ['gate_security', 'security_head', 'warden']:
            return qs

        if user.role in ['warden', 'hr'] or getattr(user, 'is_student_hr', False):
            from core.role_scopes import get_hr_building_ids, get_hr_floor_numbers  # type: ignore[import]  # pyre-ignore
            from django.db.models import Q  # type: ignore[import]  # pyre-ignore
            assigned_buildings = get_hr_building_ids(user)
            assigned_floors = get_hr_floor_numbers(user)
            
            filter_q = Q(student__room_allocations__room__building_id__in=assigned_buildings)
            filter_q &= Q(student__room_allocations__end_date__isnull=True)
            
            if assigned_floors:
                filter_q &= Q(student__room_allocations__room__floor__in=assigned_floors)
                
            return qs.filter(filter_q).distinct()

        return qs.filter(student=user)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsGateSecurity | IsAdmin])
    def scan_qr(self, request):
        """Process QR code scan with enhanced validation and locking."""
        qr_code = request.data.get('qr_code', '').strip()
        direction = request.data.get('direction')  # 'in' or 'out'
        location = request.data.get('location', 'Main Gate')
        
        if not qr_code or direction not in ['in', 'out', 'auto']:
            return Response({'error': 'Valid qr_code and direction (in, out, or auto) required'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            # Lock the gate pass to prevent race conditions
            gate_pass = GatePass.objects.select_for_update().filter(qr_code=qr_code).first()
            
            if not gate_pass:
                return Response({'error': 'Invalid QR Code. Pass not found.'},
                                status=status.HTTP_404_NOT_FOUND)
            
            if gate_pass.status != 'approved' and gate_pass.status != 'used':
                return Response({'error': f'Cannot scan pass with status: {gate_pass.status}'},
                                status=status.HTTP_400_BAD_REQUEST)
            
            # Additional logic: prevent multiple "out" scans if already out
            last_scan = GateScan.objects.filter(gate_pass=gate_pass).order_by('-scan_time').first()
            if last_scan and last_scan.direction == direction:
                 return Response({'error': f'Duplicate {direction} scan detected.'},
                                status=status.HTTP_400_BAD_REQUEST)

            # Auto-detect direction based on gate pass status
            if direction == 'auto':
                if gate_pass.status == 'approved':
                    direction = 'out'
                elif gate_pass.status == 'used':
                    direction = 'in'
                else:
                    return Response(
                        {'error': f'Cannot auto-scan pass with status: {gate_pass.status}'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            student = gate_pass.student

            scan = GateScan.objects.create(
                gate_pass=gate_pass,
                student=student,
                direction=direction,
                qr_code=qr_code,
                location=location,
                scan_method='qr',
            )

            # Update gate pass status and audit fields
            if direction == 'out' and gate_pass.status == 'approved':
                gate_pass.status = 'out'
                gate_pass.actual_exit_at = timezone.now()
                gate_pass.save(update_fields=['status', 'actual_exit_at', 'updated_at'])
            elif direction == 'in' and gate_pass.status == 'out':
                gate_pass.status = 'in'
                gate_pass.actual_entry_at = timezone.now()
                
                # Late logic
                now = timezone.now()
                if gate_pass.entry_date and now > gate_pass.entry_date:
                    diff = now - gate_pass.entry_date
                    gate_pass.late_minutes = int(diff.total_seconds() // 60)
                    student = gate_pass.student
                    student.late_count += 1
                    student.save(update_fields=['late_count'])
                    gate_pass.late_count = student.late_count
                
                gate_pass.status = 'completed'
                
                if gate_pass.audio_brief:
                    try:
                        gate_pass.audio_brief.delete(save=False)
                    except Exception as e:
                        logger.warning(f"Failed to delete audio_brief for pass {gate_pass.id}: {e}")
                
                gate_pass.save()
            
            # Log the successful scan
            AuditLogger.log_action(request.user.id, 'scan', 'gate_pass', gate_pass.id, 
                                  {'direction': direction, 'location': location})

            # Notify student via structured event
            def send_scan_updates():
                emit_event(
                    'gatepass.exited' if direction == 'in' else 'gatepass.returned',
                    {
                        'id': gate_pass.id,
                        'direction': direction,
                        'status': gate_pass.status,
                        'resource': 'gate_pass',
                    },
                    user_id=student.id,
                    to_management=True,
                )

            transaction.on_commit(send_scan_updates)

            serializer = self.get_serializer(scan)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
