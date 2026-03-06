"""Gate passes views with enhanced security and validation."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.throttles import ExportRateThrottle
from core.permissions import (
    IsWarden, IsAdmin, IsGateSecurity, 
    user_is_admin, user_is_staff, user_is_hr, ROLE_STUDENT,
    ROLE_WARDEN, ROLE_HEAD_WARDEN
)
from apps.auth.models import User
from core.role_scopes import get_warden_building_ids, user_is_top_level_management
from core.security import InputValidator, AuditLogger
from core.errors import (
    PermissionAPIError,
    api_error_response
)
from django.utils import timezone
from typing import Optional
from .models import GatePass, GateScan
from .serializers import GatePassSerializer, GateScanSerializer
from apps.rooms.models import RoomAllocation
from django.db.models import Prefetch, Q
import logging
from django.db import transaction
from django.core.cache import cache
from apps.notifications.utils import notify_user, notify_role
from core.pagination import StandardCursorPagination
from core import cache_keys as ck

# REMOVED: from apps.gate_scans.models import GateScan as GateScanLog
from websockets.broadcast import broadcast_to_role, broadcast_to_updates_user, broadcast_to_management

logger = logging.getLogger(__name__)


class GatePassViewSet(viewsets.ModelViewSet):
    """ViewSet for Gate Pass management with enhanced security."""

    # Manual Redis caching for list endpoint (OPTION B)
    # Cache key includes filters, user, and CACHE_VERSION from settings
    # Invalidate cache on create/update/destroy

    def _get_list_cache_key(self, request):
        """Builds a versioned cache key for the list endpoint based on filters and user."""
        user = request.user
        params = request.query_params.dict()
        params_parts = ":".join(f"{k}:{params[k]}" for k in sorted(params))
        import hashlib
        params_fingerprint = hashlib.md5(params_parts.encode()).hexdigest()[:12]
        return ck.gatepass_list(user.id, params_fingerprint)

    def list(self, request, *args, **kwargs):
        """List gate passes with manual Redis caching (OPTION B).

        The full paginated response dict (results + next/previous cursor) is
        cached so cursor clients receive stable navigation tokens.
        """
        cache_key = self._get_list_cache_key(request)
        cached = cache.get(cache_key)
        if cached is not None:
            from rest_framework.response import Response as DRFResponse
            return DRFResponse(cached)

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            paginated_response = self.get_paginated_response(serializer.data)
            cache.set(cache_key, paginated_response.data, timeout=300)  # 5 min TTL
            return paginated_response

        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        cache.set(cache_key, data, timeout=300)
        return Response(data)

    def _invalidate_list_cache(self, user_id):
        """Deletes all list cache keys for a specific user ID (wildcard)."""
        prefix = ck.gatepass_list_prefix(user_id)
        # Use django-redis delete_pattern for wildcard deletion
        try:
            cache.delete_pattern(f"{prefix}*")
        except Exception:
            # Fallback: ignore if not supported or not using Redis
            pass

    def _invalidate_pass_related_caches(self, gate_pass):
        """Invalidate caches for both the student and the current acting person."""
        # 1. Invalidate current acting user's list cache
        if hasattr(self.request, 'user') and self.request.user.id:
            self._invalidate_list_cache(self.request.user.id)
        
        # 2. Invalidate student's caches
        if gate_pass and gate_pass.student_id:
            # Invalidate list cache
            if not hasattr(self.request, 'user') or gate_pass.student_id != self.request.user.id:
                self._invalidate_list_cache(gate_pass.student_id)
            
            # Invalidate student bundle metrics cache
            cache.delete(ck.student_bundle(gate_pass.student_id))

        # 3. Invalidate global metrics (since pending/active pass counts might have changed)
        cache.delete(ck.metrics_dashboard_global())


    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        response = super().destroy(request, *args, **kwargs)
        # Invalidate both the student's and the acting staff's caches
        self._invalidate_pass_related_caches(instance)
        return response

    
    # optimize queryset with select_related for student profile and room allocation to fix N+1
    queryset = GatePass.objects.select_related(
        'student', 
        'student__tenant',
        'approved_by'
    ).prefetch_related('student__groups').all()
    serializer_class = GatePassSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardCursorPagination
    
    def get_permissions(self):
        """Set permissions based on action with proper security."""
        if self.action in ['approve', 'reject', 'destroy']:
            # Only admins and wardens can approve/reject/delete
            return [IsAuthenticated(), (IsAdmin() | IsWarden())]
        elif self.action == 'verify':
            # ONLY gate security and security head can verify (IN/OUT)
            from core.permissions import IsSecurityPersonnel
            return [IsAuthenticated(), IsSecurityPersonnel()]
        elif self.action == 'create':
            # Students create their own passes OR staff create for others
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
        
        # Base queryset with deep select_related to satisfy UserSerializer and GatePassSerializer
        queryset = GatePass.objects.select_related(
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

        # Search with validation
        search_ticket = self.request.query_params.get('hall_ticket', '').strip()
        if search_ticket:
            # Sanitize input
            try:
                search_ticket = InputValidator.validate_string(search_ticket, "hall_ticket", 50)
                queryset = queryset.filter(student__registration_number__icontains=search_ticket)
            except Exception as e:
                logger.warning(f"Invalid search ticket: {str(e)}")

        # Status filter with validation
        status_filter = self.request.query_params.get('status', '').strip()
        if status_filter:
            try:
                allowed_statuses = ['pending', 'approved', 'rejected', 'used', 'expired']
                status_filter = InputValidator.validate_status(status_filter, allowed_statuses)
                queryset = queryset.filter(status=status_filter)
            except Exception as e:
                logger.warning(f"Invalid status filter: {str(e)}")

        # Role-based filtering
        # Role-based filtering
        if user_is_top_level_management(user):
            return queryset.order_by('-created_at')

        if user.role in ['gate_security', 'security_head']:
            return queryset.filter(status__in=['approved', 'used']).order_by('-created_at')
        
        if user.role == 'warden' or user_is_hr(user):
            # Scope-based access for Wardens and HR
            from core.role_scopes import get_hr_building_ids, get_hr_floor_numbers
            assigned_buildings = get_hr_building_ids(user)
            assigned_floors = get_hr_floor_numbers(user)
            
            filter_q = Q(student__room_allocations__room__building_id__in=assigned_buildings)
            filter_q &= Q(student__room_allocations__end_date__isnull=True)
            
            if assigned_floors:
                filter_q &= Q(student__room_allocations__room__floor__in=assigned_floors)
                
            return queryset.filter(filter_q).distinct().order_by('-created_at')
        
        # Default: Students see only their own
        return queryset.filter(student=user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Create a gate pass with ownership validation."""
        user = request.user
        
        # Create a mutable copy of the request data
        mutable_data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        
        # Validate student_id ownership for non-admin users
        student_id = mutable_data.get('student_id')
        target_student_id = user.id

        if not user_is_admin(user):
            # Students can only create for themselves
            if user.role == ROLE_STUDENT:
                if student_id and str(student_id) != str(user.id):
                    AuditLogger.log_action(user.id, 'create_denied', 'gate_pass', student_id, success=False)
                    return api_error_response(
                        "Students can only create passes for themselves",
                        "PERMISSION_DENIED",
                        status_code=403
                    )
            elif user.role in [ROLE_WARDEN, ROLE_HEAD_WARDEN] and student_id and str(student_id) != str(user.id):
                warden_buildings = get_warden_building_ids(user)
                has_student = RoomAllocation.objects.filter(
                    student_id=student_id,
                    room__building_id__in=warden_buildings,
                    end_date__isnull=True
                ).exists()
                if not has_student:
                    return api_error_response("Wardens can only create passes for students in their assigned blocks.", "PERMISSION_DENIED", 403)
                target_student_id = student_id
            elif user_is_staff(user) and student_id and str(student_id) != str(user.id):
                # Security/Chefs shouldn't create passes
                if user.role in ['gate_security', 'security_head', 'chef']:
                    return api_error_response("You don't have permission to create gate passes for students.", "PERMISSION_DENIED", 403)
                target_student_id = student_id
        else:
            if student_id:
                target_student_id = student_id

        # In case the staff is creating it for a student, we need the actual user object
        target_student = user
        if str(target_student_id) != str(user.id):
            from django.shortcuts import get_object_or_404
            target_student = get_object_or_404(User, id=target_student_id)
            
        mutable_data['student_id'] = target_student_id
        
        # Validate input data safely
        try:
            if 'purpose' in mutable_data:
                mutable_data['purpose'] = InputValidator.validate_string(
                    mutable_data['purpose'], 'purpose', InputValidator.MAX_TEXT_FIELD
                )
            if 'destination' in mutable_data:
                mutable_data['destination'] = InputValidator.validate_string(
                    mutable_data['destination'], 'destination', InputValidator.MAX_CHAR_FIELD
                )
            if 'remarks' in mutable_data:
                mutable_data['remarks'] = InputValidator.validate_string(
                    mutable_data['remarks'], 'remarks', InputValidator.MAX_TEXT_FIELD
                )
        except Exception as e:
            return api_error_response(str(e), "VALIDATION_ERROR", status_code=400)
        
        # DSA OPTIMIZATION: Overlap Detection (Interval-like query)
        exit_date_str = mutable_data.get('exit_date')
        entry_date_str = mutable_data.get('entry_date')
        from core.date_utils import parse_iso_datetime_or_none
        exit_date = parse_iso_datetime_or_none(exit_date_str) if exit_date_str else None
        entry_date = parse_iso_datetime_or_none(entry_date_str) if entry_date_str else None

        # Determine which student we are checking overlap for checking active passes
        overlap_student_id = target_student_id
        
        if exit_date and entry_date:
            overlapping_pass = GatePass.objects.filter(
                student_id=overlap_student_id,
                status__in=['pending', 'approved', 'used']
            ).filter(
                Q(exit_date__lt=entry_date, entry_date__gt=exit_date)
            ).exists()
            
            if overlapping_pass:
                return api_error_response(
                    "You already have an active or pending gate pass that overlaps with these dates.",
                    "OVERLAP_ERROR",
                    status_code=400
                )

        serializer = self.get_serializer(data=mutable_data)
        serializer.is_valid(raise_exception=True)
        gate_pass = serializer.save(student=target_student)
        
        AuditLogger.log_action(user.id, 'create', 'gate_pass', gate_pass.id, success=True)
        
        transaction.on_commit(lambda: self._broadcast_event(gate_pass, 'gatepass_created'))

        # Notify Wardens
        try:
            notify_msg = f"New {gate_pass.pass_type} pass request from {user.get_full_name() or user.username}."
            notify_role('warden', 'New Gate Pass Request', notify_msg, 'info', '/gate-passes')
            notify_role('head_warden', 'New Gate Pass Request', notify_msg, 'info', '/gate-passes')
        except Exception as e:
            logger.error(f"Failed to send warden notifications: {str(e)}")

        # Invalidate related caches for real-time visibility
        self._invalidate_pass_related_caches(gate_pass)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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

    def _broadcast_event(self, gate_pass: GatePass, event_type: str, extra: Optional[dict] = None):
        """Safely broadcast WebSocket events with forecast cache invalidation."""
        try:
            payload = {
                'id': gate_pass.id,
                'status': gate_pass.status,
                'student_id': gate_pass.student_id,
                'resource': 'gate_pass'
            }
            if extra:
                payload.update(extra)

            # Essential for real-time: Always broadcast a generic 'gatepass_updated' 
            # for any change to ensure all staff dashboards stay in sync.
            broadcast_to_management('gatepass_updated', payload)

            # Student always gets their own updates
            broadcast_to_updates_user(gate_pass.student_id, event_type, payload)
            if event_type != 'gatepass_updated':
                broadcast_to_updates_user(gate_pass.student_id, 'gatepass_updated', payload)

            # Broadcast specific event to management
            broadcast_to_management(event_type, payload)

            # Forecast cache invalidation + chef notification (debounced)
            if event_type in ['gatepass_approved', 'gatepass_rejected', 'gatepass_canceled', 'gatepass_updated']:
                from django.core.cache import cache
                from core.services import invalidate_forecast_cache
                throttle_key = ck.gatepass_forecast_debounce(gate_pass.id)
                if not cache.get(throttle_key):
                    cache.set(throttle_key, True, timeout=5)  # 5-second debounce
                    # Invalidate forecast so next chef request recalculates
                    exit_date = gate_pass.exit_date.date() if gate_pass.exit_date else None
                    invalidate_forecast_cache(exit_date)
                    broadcast_to_role('chef', 'forecast_updated', {
                        'affected_student_id': gate_pass.student_id,
                        'date': str(exit_date) if exit_date else None,
                        'resource': 'forecast',
                    })

        except Exception as e:
            logger.error(f"WebSocket broadcast error: {str(e)}")
    
    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def last_scan(self, request):
        """Return the latest gate scan (in/out) for the authenticated user."""
        user = request.user
        
        # Use simple filter to avoid complexity for now, or adapt if GateScanLog removed
        # Since I'm using GateScan from .models, I should query that.
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
    def approve(self, request, pk=None):
        """Approve a gate pass request with validation and race-condition protection."""
        try:
            user = request.user
            
            # Verify user has permission first
            if not user_is_staff(user):
                AuditLogger.log_action(user.id, 'approve', 'gate_pass', pk, success=False)
                raise PermissionAPIError('Only staff can approve gate passes')
                
            # Lock the gate pass row to prevent double-approval race conditions
            with transaction.atomic():
                gate_pass = GatePass.objects.select_for_update().get(pk=pk)
                
                # Check status inside the lock
                if gate_pass.status != 'pending':
                    raise PermissionAPIError(f'Gate pass is already {gate_pass.status}')
            
                # Enforce Parental Approval Protocol logically in the backend
                if not gate_pass.parent_informed:
                    AuditLogger.log_action(user.id, 'approve_rejected_protocol', 'gate_pass', pk, success=False)
                    raise PermissionAPIError('Protocol Violation: You must call and verify with parents before approving this gate pass.')
                
                remarks = request.data.get('remarks', '').strip()
                if remarks:
                    remarks = InputValidator.validate_string(remarks, 'remarks', InputValidator.MAX_TEXT_FIELD)
                    
                gate_pass.status = 'approved'
                gate_pass.approved_by = user
                gate_pass.approval_remarks = remarks
                gate_pass.save()
                
                # Invalidate both student and warden caches
                self._invalidate_pass_related_caches(gate_pass)
                
                AuditLogger.log_action(user.id, 'approve', 'gate_pass', pk, {'remarks': remarks}, True)
                # Broadcast relies on commit
                transaction.on_commit(lambda: self._broadcast_event(gate_pass, 'gatepass_approved'))

            # Send persistent notification to the student
            try:
                notify_user(
                    recipient=gate_pass.student,
                    title='Gate Pass Approved ✅',
                    message=f'Your gate pass to {gate_pass.destination} has been approved by {user.get_full_name() or user.username}. Show your QR code at the gate.',
                    notification_type='info',
                    action_url='/gate-passes',
                )
                
                # Notify Security
                sec_msg = f"Gate pass approved for {gate_pass.student.get_full_name() or gate_pass.student.username} to {gate_pass.destination}."
                notify_role('gate_security', 'Gate Pass Approved', sec_msg, 'info', '/gate-scans')
                notify_role('security_head', 'Gate Pass Approved', sec_msg, 'info', '/gate-scans')
            except Exception:
                logger.warning(f'Failed to send approval notification for gate pass {pk}')

            serializer = self.get_serializer(gate_pass)
            return Response(serializer.data)
        except PermissionAPIError:
            raise
        except Exception as e:
            logger.error(f"Approve error: {str(e)}")
            return api_error_response(str(e), "ERROR", status_code=400)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a gate pass request with validation and race-condition protection."""
        try:
            user = request.user
            
            # Verify user has permission
            if not user_is_staff(user):
                AuditLogger.log_action(user.id, 'reject', 'gate_pass', pk, success=False)
                raise PermissionAPIError('Only staff can reject gate passes')
                
            # Lock the gate pass row to prevent double-reject/approve race conditions
            with transaction.atomic():
                gate_pass = GatePass.objects.select_for_update().get(pk=pk)
                
                # Check status inside the lock
                if gate_pass.status != 'pending':
                    raise PermissionAPIError(f'Gate pass is already {gate_pass.status}')
            
                # Validate remarks if provided
                remarks = request.data.get('remarks', '').strip()
                if remarks:
                    remarks = InputValidator.validate_string(remarks, 'remarks', InputValidator.MAX_TEXT_FIELD)
                
                gate_pass.status = 'rejected'
                gate_pass.approved_by = user
                gate_pass.approval_remarks = remarks
                
                if gate_pass.audio_brief:
                    try:
                        gate_pass.audio_brief.delete(save=False)
                    except Exception as e:
                        logger.warning(f"Failed to delete audio_brief for rejected pass {gate_pass.id}: {e}")
                        
                gate_pass.save()
                
                # Invalidate both student and warden caches
                self._invalidate_pass_related_caches(gate_pass)
                
                AuditLogger.log_action(user.id, 'reject', 'gate_pass', pk, {'remarks': remarks}, True)
                
                # Broadcast event after transaction commits successfully
                transaction.on_commit(lambda: self._broadcast_event(gate_pass, 'gatepass_rejected'))

            # Send persistent notification to the student
            try:
                notify_user(
                    recipient=gate_pass.student,
                    title='Gate Pass Rejected ❌',
                    message=f'Your gate pass to {gate_pass.destination} was rejected.{" Reason: " + remarks if remarks else " Contact warden for details."}',
                    notification_type='alert',
                    action_url='/gate-passes',
                )
            except Exception:
                logger.warning(f'Failed to send rejection notification for gate pass {pk}')

            serializer = self.get_serializer(gate_pass)
            return Response(serializer.data)
        except PermissionAPIError:
            raise
        except Exception as e:
            logger.error(f"Reject error: {str(e)}")
            return api_error_response(str(e), "ERROR", status_code=400)

    @action(detail=True, methods=['post'])
    def mark_informed(self, request, pk=None):
        """Mark that parents have been informed about this gate pass."""
        try:
            gate_pass = self.get_object()
            user = request.user
            
            if not user_is_staff(user):
                raise PermissionAPIError('Only staff can mark parents as informed')
            
            gate_pass.parent_informed = True
            gate_pass.parent_informed_at = timezone.now()
            gate_pass.save()
            
            # Invalidate related caches
            self._invalidate_pass_related_caches(gate_pass)
            
            AuditLogger.log_action(user.id, 'mark_informed', 'gate_pass', pk, success=True)
            
            # Broadcast update
            transaction.on_commit(lambda: self._broadcast_event(gate_pass, 'gatepass_parent_informed'))
            
            serializer = self.get_serializer(gate_pass)
            return Response(serializer.data)
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
        from django.http import StreamingHttpResponse
        
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
        """Verify gate entry/exit by security with enhanced validation."""
        try:
            with transaction.atomic():
                gate_pass = self.get_object()
                user = request.user
                
                # Verify user has permission: ONLY gate security and security head
                from core.permissions import ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD
                if user.role not in [ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD]:
                    AuditLogger.log_action(user.id, 'verify', 'gate_pass', pk, success=False)
                    raise PermissionAPIError('Only gate security personnel can verify passes')
                
                action_type = request.data.get('action', '').strip()
                
                # Validate action
                if action_type not in ['check_out', 'check_in', 'deny_exit']:
                    return api_error_response(
                        "Invalid action. Use 'check_out', 'check_in', or 'deny_exit'",
                        "VALIDATION_ERROR",
                        status_code=400
                    )

                # Validate status transitions with graceful handling of redundant actions
                if action_type == 'check_out':
                    if gate_pass.status == 'used':
                        return Response(self.get_serializer(gate_pass).data)
                    if gate_pass.status != 'approved':
                        return api_error_response(
                            f'Gate pass is currently {gate_pass.status}. It must be approved before checkout.',
                            "INVALID_STATUS",
                            status_code=400
                        )
                elif action_type == 'check_in':
                    if gate_pass.status == 'expired':
                        return Response(self.get_serializer(gate_pass).data)
                    if gate_pass.status != 'used':
                        return api_error_response(
                            f'Student is currently {gate_pass.status}. Cannot check in unless they are currently OUT.',
                            "INVALID_STATUS",
                            status_code=400
                        )
                elif action_type == 'deny_exit':
                    if gate_pass.status == 'rejected':
                        return Response(self.get_serializer(gate_pass).data)
                    if gate_pass.status != 'approved':
                        return api_error_response(
                            'Only approved passes can be denied at the gate.',
                            "INVALID_STATUS",
                            status_code=400
                        )
                
                # Removed time window validation as per requirements to allow check-in/out at any time.
                pass
                
                # Log the scan
                direction = 'out' if action_type == 'check_out' else 'in'
                location = request.data.get('location', 'Main Gate').strip()
                location = InputValidator.validate_string(location, 'location', 100)
                
                # Create ONE scan record in GatePass.GateScan table
                scan = GateScan.objects.create(
                    gate_pass=gate_pass,
                    student=gate_pass.student,
                    direction=direction,
                    qr_code=f"MANUAL_{gate_pass.id}_{timezone.now().timestamp()}",
                    location=location,
                )

                scan_payload = {
                    'id': scan.id,
                    'student_id': scan.student_id,
                    'direction': scan.direction,
                    'scan_time': scan.scan_time.isoformat(),
                    'location': scan.location,
                    'verified': True,
                    'resource': 'gate_scan',
                }
                
                # Update gate pass status and audit fields
                if action_type == 'check_out':
                    gate_pass.status = 'used'
                    gate_pass.actual_exit_at = timezone.now()
                elif action_type == 'deny_exit':
                    gate_pass.status = 'rejected'
                    gate_pass.approval_remarks = "Security explicitly denied exit at gate."
                    if gate_pass.audio_brief:
                        try:
                            gate_pass.audio_brief.delete(save=False)
                        except Exception as e:
                            logger.warning(f"Failed to delete audio_brief for pass {gate_pass.id}: {e}")
                else:
                    gate_pass.status = 'expired'
                    gate_pass.actual_entry_at = timezone.now()
                    
                    if gate_pass.audio_brief:
                        try:
                            gate_pass.audio_brief.delete(save=False)
                        except Exception as e:
                            logger.warning(f"Failed to delete audio_brief for pass {gate_pass.id}: {e}")
                    
                gate_pass.save(update_fields=['status', 'actual_exit_at', 'actual_entry_at', 'updated_at', 'approval_remarks', 'audio_brief'])
                
                AuditLogger.log_action(user.id, 'verify', 'gate_pass', pk, 
                                     {'action': action_type, 'location': location}, True)

                # Move broadcast to on_commit to prevent ghost updates if DB fails
                def send_updates():
                    broadcast_to_updates_user(scan.student_id, 'gate_scan_logged', scan_payload)
                    for role in ['staff', 'admin', 'super_admin', 'warden', 'head_warden', 'gate_security', 'security_head', 'chef']:
                        broadcast_to_role(role, 'gate_scan_logged', scan_payload)
                    self._broadcast_event(gate_pass, 'gatepass_updated', extra={'action': action_type})

                transaction.on_commit(send_updates)
                
                # Invalidate related caches
                self._invalidate_pass_related_caches(gate_pass)
                
                serializer = self.get_serializer(gate_pass)
                return Response(serializer.data)
        except PermissionAPIError:
            raise
        except Exception as e:
            logger.error(f"Verify error: {str(e)}")
            return api_error_response(str(e), "ERROR", status_code=400)


class GateScanViewSet(viewsets.ModelViewSet):
    """ViewSet for Gate Scan logging."""
    
    queryset = GateScan.objects.all()
    serializer_class = GateScanSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Only gate staff and admin can create scans."""
        if self.action in ['create', 'scan_qr']:
            from core.permissions import IsSecurityPersonnel
            return [IsAuthenticated(), IsSecurityPersonnel()]
        else:
            return [IsAuthenticated()]
    
    def get_queryset(self):
        """Filter based on user role with bounded prefetching for performance."""
        user = self.request.user
        
        # Base queryset with necessary relationships for GateScanSerializer
        qs = GateScan.objects.select_related(
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
            from core.role_scopes import get_hr_building_ids, get_hr_floor_numbers
            from django.db.models import Q
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
        
        if not qr_code or direction not in ['in', 'out']:
            return Response({'error': 'Valid qr_code and direction (in/out) required'},
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

            student = gate_pass.student
            
            scan = GateScan.objects.create(
                gate_pass=gate_pass,
                student=student,
                direction=direction,
                qr_code=qr_code,
                location=location
            )

            # Update gate pass status and audit fields
            if direction == 'out' and gate_pass.status == 'approved':
                gate_pass.status = 'used'
                gate_pass.actual_exit_at = timezone.now()
                gate_pass.save(update_fields=['status', 'actual_exit_at', 'updated_at'])
            elif direction == 'in' and gate_pass.status == 'used':
                gate_pass.status = 'expired'
                gate_pass.actual_entry_at = timezone.now()
                
                # Delete audio brief automatically to save storage as requested
                if gate_pass.audio_brief:
                    try:
                        gate_pass.audio_brief.delete(save=False)
                    except Exception as e:
                        logger.warning(f"Failed to delete audio_brief for pass {gate_pass.id}: {e}")
                
                gate_pass.save(update_fields=['status', 'actual_entry_at', 'audio_brief', 'updated_at'])
            
            # Log the successful scan
            AuditLogger.log_action(request.user.id, 'scan', 'gate_pass', gate_pass.id, 
                                  {'direction': direction, 'location': location})

            # Notify student
            def send_scan_updates():
                broadcast_to_updates_user(student.id, 'gate_scanned', {
                    'id': gate_pass.id,
                    'direction': direction,
                    'status': gate_pass.status
                })

            transaction.on_commit(send_scan_updates)

            serializer = self.get_serializer(scan)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
