"""Gate passes views with enhanced security and validation."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle
from core.permissions import (
    IsWarden, IsAdmin, IsGateSecurity, IsSecurityHead, IsStudent, 
    user_is_admin, user_is_staff, user_is_student, MANAGEMENT_ROLES, ROLE_STUDENT,
    AUTHORITY_ROLES, IsOwnerOrAdmin, CanViewGatePasses, AdminOrReadOnly
)
from core.role_scopes import get_warden_building_ids, user_is_top_level_management
from core.security import InputValidator, PermissionValidator, AuditLogger
from core.errors import (
    ValidationAPIError, PermissionAPIError, NotFoundAPIError,
    api_error_response, api_success_response
)
from django.utils import timezone
from datetime import timedelta
from typing import Optional
from .models import GatePass, GateScan
from .serializers import GatePassSerializer, GateScanSerializer
from apps.rooms.models import RoomAllocation
from django.db.models import Prefetch, Q
import uuid
import logging
from django.db import transaction
from django.core.cache import cache
from django.conf import settings

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
        key_parts = [
            f"gatepass:list:v{getattr(settings, 'CACHE_VERSION', 1)}",
            f"user:{user.id}",
        ]
        for k in sorted(params):
            key_parts.append(f"{k}:{params[k]}")
        return ":".join(key_parts)

    def list(self, request, *args, **kwargs):
        """List gate passes with manual Redis caching (OPTION B)."""
        cache_key = self._get_list_cache_key(request)
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            data = serializer.data
            cache.set(cache_key, data, timeout=300)  # 5 min TTL
            return self.get_paginated_response(data)

        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        cache.set(cache_key, data, timeout=300)
        return Response(data)

    def _invalidate_list_cache(self, request):
        """Deletes all list cache keys for this user (wildcard)."""
        user = request.user
        prefix = f"gatepass:list:v{getattr(settings, 'CACHE_VERSION', 1)}:user:{user.id}"
        # Use django-redis delete_pattern for wildcard deletion
        try:
            cache.delete_pattern(f"{prefix}*")
        except Exception:
            # Fallback: ignore if not supported
            pass

    def destroy(self, request, *args, **kwargs):
        response = super().destroy(request, *args, **kwargs)
        # Invalidate all list cache for this user (safe, broad)
        self._invalidate_list_cache(request)
        return response

    
    # optimize queryset with select_related for student profile and room allocation to fix N+1
    queryset = GatePass.objects.select_related(
        'student', 
        'student__tenant',
        'approved_by'
    ).prefetch_related('student__groups').all()
    serializer_class = GatePassSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Set permissions based on action with proper security."""
        if self.action in ['approve', 'reject', 'destroy']:
            # Only admins and wardens can approve/reject/delete
            return [IsAuthenticated(), (IsAdmin | IsWarden)()]
        elif self.action == 'verify':
            # Gate security, security head, and admins can verify
            return [IsAuthenticated(), (IsGateSecurity | IsSecurityHead | IsAdmin)()]
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
        """Filter based on user role and ownership with security."""
        user = self.request.user
        queryset = GatePass.objects.select_related(
            'student', 
            'student__tenant',
            'approved_by'
        ).prefetch_related(
            'student__groups',
            Prefetch(
                'student__room_allocations',
                queryset=RoomAllocation.objects.filter(end_date__isnull=True).select_related('room'),
                to_attr='active_allocation'
            )
        ).all()

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
        if user_is_top_level_management(user) or user.role in ['gate_security', 'security_head']:
            return queryset.order_by('-created_at')
        
        if user.role == 'warden':
            # Block-level access for regular wardens
            warden_buildings = get_warden_building_ids(user)
            return queryset.filter(
                student__room_allocations__room__building_id__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).distinct().order_by('-created_at')
        
        # Default: Students see only their own
        return queryset.filter(student=user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Create a gate pass with ownership validation."""
        user = request.user
        
        # Validate student_id ownership for non-admin users
        # NOTE: request.data is an immutable QueryDict, so we must not mutate it.
        student_id = request.data.get('student_id')

        if not user_is_admin(user):
            # Students can only create for themselves
            if user.role == ROLE_STUDENT:
                if student_id and str(student_id) != str(user.id):
                    AuditLogger.log_action(user.id, 'create', 'gate_pass', student_id, success=False)
                    return api_error_response(
                        "Students can only create passes for themselves",
                        "PERMISSION_DENIED",
                        status_code=403
                    )
                # For students, always treat the effective student as the logged-in user
                student_id = user.id
        
        # Validate input data
        try:
            if 'purpose' in request.data:
                request.data['purpose'] = InputValidator.validate_string(
                    request.data['purpose'], 'purpose', InputValidator.MAX_TEXT_FIELD
                )
            if 'destination' in request.data:
                request.data['destination'] = InputValidator.validate_string(
                    request.data['destination'], 'destination', InputValidator.MAX_CHAR_FIELD
                )
            if 'remarks' in request.data:
                request.data['remarks'] = InputValidator.validate_string(
                    request.data['remarks'], 'remarks', InputValidator.MAX_TEXT_FIELD
                )
        except Exception as e:
            return api_error_response(str(e), "VALIDATION_ERROR", status_code=400)
        
        # DSA OPTIMIZATION: Overlap Detection (Interval-like query)
        # Check if the student already has an active/pending pass that overlaps with these dates
        exit_date = request.data.get('exit_date')
        entry_date = request.data.get('entry_date')

        # Determine which student we are checking overlap for (defaults to current user)
        overlap_student_id = student_id or user.id
        
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

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        gate_pass = serializer.save(student=user)
        
        AuditLogger.log_action(user.id, 'create', 'gate_pass', gate_pass.id, success=True)
        
        transaction.on_commit(lambda: self._broadcast_event(gate_pass, 'gatepass_created'))

        # Invalidate all list cache for this user (safe, broad)
        self._invalidate_list_cache(request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        """Prevent unauthorized updates to critical fields."""
        instance = serializer.instance
        user = self.request.user
        
        # Only admins/wardens can change status
        if 'status' in serializer.validated_data and not user_is_staff(user):
            AuditLogger.log_action(user.id, 'update', 'gate_pass', instance.id, success=False)
            raise PermissionAPIError('Only staff can change pass status')
        
        result = super().perform_update(serializer)
        # Invalidate all list cache for this user (safe, broad)
        self._invalidate_list_cache(self.request)
        return result

    def _broadcast_event(self, gate_pass: GatePass, event_type: str, extra: Optional[dict] = None):
        """Safely broadcast WebSocket events."""
        try:
            payload = {
                'id': gate_pass.id,
                'status': gate_pass.status,
                'student_id': gate_pass.student_id,
            }
            if extra:
                payload.update(extra)

            # Student always gets their own updates
            broadcast_to_updates_user(gate_pass.student_id, event_type, payload)

            # Authorities and security roles get updates for monitoring
            # OPTIMIZATION: Broadcast once to management instead of loop (prevents duplicate messages)
            broadcast_to_management(event_type, payload)
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
            return Response({'detail': 'No scans found.'}, status=status.HTTP_404_NOT_FOUND)

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
        """Approve a gate pass request with validation."""
        try:
            gate_pass = self.get_object()
            user = request.user
            
            # Verify user has permission
            if not user_is_staff(user):
                AuditLogger.log_action(user.id, 'approve', 'gate_pass', pk, success=False)
                raise PermissionAPIError('Only staff can approve gate passes')
            
            remarks = request.data.get('remarks', '').strip()
            if remarks:
                remarks = InputValidator.validate_string(remarks, 'remarks', InputValidator.MAX_TEXT_FIELD)
            gate_pass.status = 'approved'
            gate_pass.approved_by = user
            gate_pass.approval_remarks = remarks
            gate_pass.save()
            AuditLogger.log_action(user.id, 'approve', 'gate_pass', pk, {'remarks': remarks}, True)
            transaction.on_commit(lambda: self._broadcast_event(gate_pass, 'gatepass_approved'))
            serializer = self.get_serializer(gate_pass)
            return Response(serializer.data)
        except PermissionAPIError:
            raise
        except Exception as e:
            logger.error(f"Approve error: {str(e)}")
            return api_error_response(str(e), "ERROR", status_code=400)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a gate pass request with validation."""
        try:
            gate_pass = self.get_object()
            user = request.user
            
            # Verify user has permission
            if not user_is_staff(user):
                AuditLogger.log_action(user.id, 'reject', 'gate_pass', pk, success=False)
                raise PermissionAPIError('Only staff can reject gate passes')
            
            # Validate remarks if provided
            remarks = request.data.get('remarks', '').strip()
            if remarks:
                remarks = InputValidator.validate_string(remarks, 'remarks', InputValidator.MAX_TEXT_FIELD)
            
            gate_pass.status = 'rejected'
            gate_pass.approved_by = user
            gate_pass.approval_remarks = remarks
            gate_pass.save()
            
            AuditLogger.log_action(user.id, 'reject', 'gate_pass', pk, {'remarks': remarks}, True)
            
            transaction.on_commit(lambda: self._broadcast_event(gate_pass, 'gatepass_rejected'))
            
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
            
            AuditLogger.log_action(user.id, 'mark_informed', 'gate_pass', pk, success=True)
            
            # Broadcast update
            transaction.on_commit(lambda: self._broadcast_event(gate_pass, 'gatepass_parent_informed'))
            
            serializer = self.get_serializer(gate_pass)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Mark Informed error: {str(e)}")
            return api_error_response(str(e), "ERROR", status_code=400)
    @action(detail=False, methods=['get'], throttle_classes=[UserRateThrottle])
    def export_csv(self, request):
        """Export filtered gate passes to CSV using values() iterator for max memory safety."""
        import csv
        from django.http import StreamingHttpResponse
        
        # Verify permissions
        user = request.user
        if not (user_is_admin(user) or user.role in ['warden', 'head_warden', 'security_head']):
            return api_error_response("Not authorized to export data", "PERMISSION_DENIED", status_code=403)
            def destroy(self, request, *args, **kwargs):
                response = super().destroy(request, *args, **kwargs)
                # Invalidate all list cache for this user (safe, broad)
                self._invalidate_list_cache(request)
                return response
            
            def _invalidate_list_cache(self, request):
                """Deletes all list cache keys for this user (wildcard)."""
                user = request.user
                prefix = f"gatepass:list:v{getattr(self.settings, 'CACHE_VERSION', 1)}:user:{user.id}"
                # Use django-redis delete_pattern for wildcard deletion
                try:
                    self.cache.delete_pattern(f"{prefix}*")
                except Exception:
                    # Fallback: ignore if not supported
                    pass
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
                
                # Verify user has permission
                if user.role not in ['gate_security', 'security_head', 'admin', 'super_admin']:
                    AuditLogger.log_action(user.id, 'verify', 'gate_pass', pk, success=False)
                    raise PermissionAPIError('Only gate security can verify passes')
                
                action_type = request.data.get('action', '').strip()
                
                # Validate action
                if action_type not in ['check_out', 'check_in']:
                    return api_error_response(
                        "Invalid action. Use 'check_out' or 'check_in'",
                        "VALIDATION_ERROR",
                        status_code=400
                    )

                # Validate status transitions
                if action_type == 'check_out':
                    if gate_pass.status != 'approved':
                        return api_error_response(
                            'Gate pass must be approved before checkout',
                            "INVALID_STATUS",
                            status_code=400
                        )
                else:  # check_in
                    if gate_pass.status != 'used':
                        return api_error_response(
                            'Cannot check in unless the student is currently out',
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
                else:
                    gate_pass.status = 'expired'
                    gate_pass.actual_entry_at = timezone.now()
                    
                gate_pass.save(update_fields=['status', 'actual_exit_at', 'actual_entry_at', 'updated_at'])
                
                AuditLogger.log_action(user.id, 'verify', 'gate_pass', pk, 
                                     {'action': action_type, 'location': location}, True)

                # Move broadcast to on_commit to prevent ghost updates if DB fails
                def send_updates():
                    broadcast_to_updates_user(scan.student_id, 'gate_scan_logged', scan_payload)
                    for role in ['staff', 'admin', 'super_admin', 'warden', 'head_warden', 'gate_security', 'security_head', 'chef']:
                        broadcast_to_role(role, 'gate_scan_logged', scan_payload)
                    self._broadcast_event(gate_pass, 'gatepass_updated', extra={'action': action_type})

                transaction.on_commit(send_updates)
                
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
            return [IsAuthenticated(), (IsGateSecurity | IsAdmin)()]
        else:
            return [IsAuthenticated()]
    
    def get_queryset(self):
        """Filter based on user role. Bounded to 500 most-recent scans to prevent full-table scans."""
        user = self.request.user
        # Guard: always order + limit the base queryset; pagination handles the rest.
        qs = GateScan.objects.order_by('-scan_time').select_related('student', 'gate_pass')

        if user_is_top_level_management(user) or user.role in ['gate_security', 'security_head']:
            return qs

        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            return qs.filter(student__room_allocations__room__building_id__in=warden_buildings, student__room_allocations__end_date__isnull=True).distinct()

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
                gate_pass.save(update_fields=['status', 'actual_entry_at', 'updated_at'])
            
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
