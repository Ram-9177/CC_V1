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
import uuid
import logging
from django.db import transaction

# REMOVED: from apps.gate_scans.models import GateScan as GateScanLog
from websockets.broadcast import broadcast_to_role, broadcast_to_updates_user

logger = logging.getLogger(__name__)


class GatePassViewSet(viewsets.ModelViewSet):
    """ViewSet for Gate Pass management with enhanced security."""
    
    # optimize queryset with select_related for student profile and room allocation to fix N+1
    # FIX N+1: Use prefetch_related for active room allocations
    from apps.rooms.models import RoomAllocation
    from django.db.models import Prefetch

    queryset = GatePass.objects.select_related(
        'student', 
        'approved_by'
    ).prefetch_related(
        Prefetch(
            'student__room_allocations',
            queryset=RoomAllocation.objects.filter(end_date__isnull=True).select_related('room'),
            to_attr='active_allocation'
        )
    ).all()
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
            'approved_by'
        ).prefetch_related(
            'student__room_allocations__room'
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
        if user.role in AUTHORITY_ROLES or user.role in ['gate_security', 'security_head']:
            return queryset.order_by('-created_at')
        
        # Default: Students see only their own
        return queryset.filter(student=user).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        """Create a gate pass with ownership validation."""
        user = request.user
        
        # Validate student_id ownership for non-admin users
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
                request.data['student_id'] = user.id
        
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
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        gate_pass = serializer.save(student=user)
        
        AuditLogger.log_action(user.id, 'create', 'gate_pass', gate_pass.id, success=True)
        self._broadcast_event(gate_pass, 'gatepass_created')

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        """Prevent unauthorized updates to critical fields."""
        instance = serializer.instance
        user = self.request.user
        
        # Only admins/wardens can change status
        if 'status' in serializer.validated_data and not user_is_staff(user):
            AuditLogger.log_action(user.id, 'update', 'gate_pass', instance.id, success=False)
            raise PermissionAPIError('Only staff can change pass status')
        
        return super().perform_update(serializer)

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
            for role in ['staff', 'admin', 'super_admin', 'warden', 'head_warden', 'gate_security', 'security_head']:
                broadcast_to_role(role, event_type, payload)
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
            
            # Validate remarks if provided
            remarks = request.data.get('remarks', '').strip()
            if remarks:
                remarks = InputValidator.validate_string(remarks, 'remarks', InputValidator.MAX_TEXT_FIELD)
            
            gate_pass.status = 'approved'
            gate_pass.approved_by = user
            gate_pass.approval_remarks = remarks
            gate_pass.save()
            
            AuditLogger.log_action(user.id, 'approve', 'gate_pass', pk, {'remarks': remarks}, True)
            self._broadcast_event(gate_pass, 'gatepass_approved')
            
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
            self._broadcast_event(gate_pass, 'gatepass_rejected')
            
            serializer = self.get_serializer(gate_pass)
            return Response(serializer.data)
        except PermissionAPIError:
            raise
        except Exception as e:
            logger.error(f"Reject error: {str(e)}")
            return api_error_response(str(e), "ERROR", status_code=400)
    @action(detail=False, methods=['get'], throttle_classes=[UserRateThrottle])
    def export_csv(self, request):
        """Export filtered gate passes to CSV using streaming for memory safety."""
        import csv
        from django.http import StreamingHttpResponse
        
        # Verify permissions
        user = request.user
        if not (user_is_admin(user) or user.role in ['warden', 'head_warden', 'security_head']):
            return api_error_response("Not authorized to export data", "PERMISSION_DENIED", status_code=403)
            
        queryset = self.get_queryset()[:10000] # Limit slightly higher for streaming
        
        class Echo:
            def write(self, value):
                return value

        def stream_gatepasses():
            buffer = Echo()
            writer = csv.writer(buffer)
            yield writer.writerow(['ID', 'Student Name', 'Reg No', 'Room', 'Type', 'Status', 
                                 'Planned Exit', 'Planned Entry', 'Actual Exit', 'Actual Entry', 
                                 'Approved By', 'Created At'])
            
            # Manual pagination to ensure select_related works and avoid creating 10000 model instances at once if iterator fails
            limit = 10000
            batch_size = 500
            
            for offset in range(0, limit, batch_size):
                batch = list(queryset[offset:offset+batch_size])
                if not batch:
                    break
                    
                for gp in batch:
                    # Retrieve room number from pre-fetched allocations
                    allocation = gp.student.active_allocation[0] if gp.student.active_allocation else None
                    room_no = allocation.room.room_number if allocation else ""
                    
                    yield writer.writerow([
                        gp.id,
                        gp.student.get_full_name() or gp.student.username,
                        gp.student.registration_number,
                        room_no,
                        gp.pass_type,
                        gp.status,
                        gp.exit_date.strftime("%Y-%m-%d %H:%M") if gp.exit_date else '',
                        gp.entry_date.strftime("%Y-%m-%d %H:%M") if gp.entry_date else '',
                        gp.actual_exit_at.strftime("%Y-%m-%d %H:%M") if gp.actual_exit_at else '',
                        gp.actual_entry_at.strftime("%Y-%m-%d %H:%M") if gp.actual_entry_at else '',
                        gp.approved_by.username if gp.approved_by else '',
                        gp.created_at.strftime("%Y-%m-%d %H:%M"),
                    ])

        response = StreamingHttpResponse(stream_gatepasses(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="gate_passes_{timezone.now().strftime("%Y%m%d_%H%M")}.csv"'
        return response
    
    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Verify gate entry/exit by security with enhanced validation."""
        try:
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
            
            # Validate time windows
            if action_type == 'check_out':
                now = timezone.now()
                # Allow checkout 1 hour before and 4 hours after planned exit
                if now < gate_pass.exit_date - timedelta(hours=1):
                    return api_error_response(
                        f'Too early for exit. Approved for {gate_pass.exit_date.strftime("%I:%M %p")}',
                        "EARLY_EXIT",
                        status_code=400
                    )
                if now > gate_pass.exit_date + timedelta(hours=4):
                    return api_error_response(
                        'Gate pass has expired. Please request a new one',
                        "EXPIRED",
                        status_code=400
                    )
            
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

            # REDUNDANT LOG REMOVED. Broadcasting using the primary Scan object.

            scan_payload = {
                'id': scan.id,
                'student_id': scan.student_id,
                'direction': scan.direction,
                'scan_time': scan.scan_time.isoformat(),
                'location': scan.location,
                'verified': True,
                'resource': 'gate_scan',
            }
            broadcast_to_updates_user(scan.student_id, 'gate_scan_logged', scan_payload)
            for role in ['staff', 'admin', 'super_admin', 'warden', 'head_warden', 'gate_security', 'security_head', 'chef']:
                broadcast_to_role(role, 'gate_scan_logged', scan_payload)
            
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
            self._broadcast_event(gate_pass, 'gatepass_updated', extra={'action': action_type})
            
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
        """Filter based on user role."""
        user = self.request.user
        if user.role in ['admin', 'super_admin', 'warden', 'head_warden', 'gate_security', 'security_head']:
            return GateScan.objects.all()
        return GateScan.objects.filter(student=user)
    
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, (IsGateSecurity | IsAdmin)()])
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
            broadcast_to_updates_user(student.id, 'gate_scanned', {
                'id': gate_pass.id,
                'direction': direction,
                'status': gate_pass.status
            })

            serializer = self.get_serializer(scan)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
