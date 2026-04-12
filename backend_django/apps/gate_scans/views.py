# DEPRECATED: This entire ViewSet is superseded by apps.gate_passes.GateScanViewSet.
# Both write to the same GateScan model (gate_passes.GateScan is the canonical source).
# This file is kept for backwards compatibility only. Do NOT add new logic here.
# Use POST /api/gate-passes/gate-scans/log_scan/ or POST /api/scan/ instead.
"""Gate scans views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import (
    IsAdmin, IsWarden, IsSecurityPersonnel,
    CanViewSecurityModule, CanManageSecurityModule,
    user_is_admin, user_is_staff, SECURITY_ROLES, AUTHORITY_ROLES, ROLE_STUDENT
)
# Use the consolidated models from gate_passes app
from apps.gate_passes.models import GateScan, GatePass
# Removed unused BaseGateScanSerializer import
from websockets.broadcast import broadcast_to_role, broadcast_to_updates_user
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from core.digital_qr import DigitalQRValidationError, resolve_user_from_digital_qr

# Create a serializer that works with the new model if needed, 
# or import the one from gate_passes if compatible.
# For now, we'll import the one from gate_passes to match the model.
from apps.gate_passes.serializers import GateScanSerializer

from core.college_mixin import CollegeScopeMixin

class GateScanViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for Gate Scan logs (Unified)."""
    
    queryset = GateScan.objects.all()
    serializer_class = GateScanSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'log_scan', 'scan_qr']:
            # Writes remain restricted to security manage capability + legacy security/admin.
            return [
                IsAuthenticated(),
                (CanManageSecurityModule | IsSecurityPersonnel | IsAdmin)(),
            ]
        else:
            # Read access for security metrics consumers via RBAC capability.
            return [
                IsAuthenticated(),
                (CanViewSecurityModule | IsWarden | IsAdmin)(),
            ]
    
    def get_queryset(self):
        """Filter based on user role and ownership."""
        user = self.request.user
        
        # Security personnel and management see all scans
        from django.db.models import Prefetch
        from apps.rooms.models import RoomAllocation

        base_qs = super().get_queryset()

        # Authority roles (Admin, Head Warden, Warden) and Security personnel see all scans
        if user.role in SECURITY_ROLES or user.role in AUTHORITY_ROLES or user_is_admin(user):
            return base_qs.select_related('student', 'gate_pass').prefetch_related(
                Prefetch(
                    'student__room_allocations',
                    queryset=RoomAllocation.objects.filter(end_date__isnull=True).select_related('room'),
                    to_attr='active_allocation'
                )
            )
        
        # Students see only their own scans
        elif user.role == ROLE_STUDENT:
            return base_qs.filter(student=user).select_related('gate_pass')
        
        # Default: see own scans
        else:
            return base_qs.filter(student=user)
    
    @action(detail=False, methods=['post'])
    def log_scan(self, request):
        """Log a gate scan and update GatePass status (Smart Scan).
        
        # DEPRECATED: Use apps.gate_passes.GateScanViewSet.log_scan instead.
        # This action is kept for backwards compatibility. Logs a deprecation warning.
        """
        import logging as _logging
        _logging.getLogger(__name__).warning(
            "DEPRECATED: gate_scans.GateScanViewSet.log_scan called. "
            "Use gate_passes.GateScanViewSet.log_scan or POST /api/scan/ instead."
        )
        # Explicit check: gate_security, security_head, and admins can log scans
        from core.permissions import ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD
        if request.user.role not in [ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD] and not user_is_admin(request.user):
            return Response({'error': 'Only gate security personnel and admins can log scans.'}, status=status.HTTP_403_FORBIDDEN)
        
        student_id = request.data.get('student_id')
        direction = request.data.get('direction')
        digital_qr = request.data.get('digital_qr', '').strip()
        location = request.data.get('location', 'Main Gate')
        
        if not direction or direction not in ['in', 'out']:
             return Response({'error': 'Valid direction (in/out) required'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Resolve student via Digital Card QR when provided.
        gate_pass = None
        resolved_student_id = None
        if digital_qr:
            try:
                scanned_user = resolve_user_from_digital_qr(digital_qr, require_active=True)
            except DigitalQRValidationError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            resolved_student_id = scanned_user.id
            if direction == 'out':
                gate_pass = GatePass.objects.filter(student_id=resolved_student_id, status='approved').order_by('-exit_date').first()
            elif direction == 'in':
                gate_pass = GatePass.objects.filter(
                    Q(student_id=resolved_student_id),
                    Q(movement_status='outside') | Q(status__in=['outside', 'used', 'out'])
                ).order_by('-actual_exit_at').first()
        
        # 2. If no QR or not found, try to find ACTIVE pass by Student ID
        if not gate_pass and student_id:
            if direction == 'out':
                 gate_pass = GatePass.objects.filter(student_id=student_id, status='approved').order_by('-exit_date').first()
            elif direction == 'in':
                 gate_pass = GatePass.objects.filter(
                     Q(student_id=student_id),
                     Q(movement_status='outside') | Q(status__in=['outside', 'used', 'out'])
                 ).order_by('-actual_exit_at').first()

        # 3. Determine the student
        if gate_pass:
            resolved_student_id = gate_pass.student_id
        elif student_id and resolved_student_id is None:
            # Validate that the student exists
            from apps.auth.models import User
            if User.objects.filter(id=student_id, role='student').exists():
                resolved_student_id = student_id
            else:
                return Response({'error': 'Student not found with given ID'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'Could not identify student. Provide a valid digital_qr or student_id.'}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Create Scan Record & Update Pass
        with transaction.atomic():
            if gate_pass:
                gate_pass = GatePass.objects.select_for_update().get(id=gate_pass.id)
                
                if direction == 'out' and gate_pass.status == 'approved':
                    now = timezone.now()
                    gate_pass.status = 'outside'
                    gate_pass.movement_status = 'outside'
                    gate_pass.actual_exit_at = now
                    gate_pass.exit_time = now
                    gate_pass.exit_security = request.user
                    gate_pass.save(update_fields=['status', 'movement_status', 'actual_exit_at', 'exit_time', 'exit_security', 'updated_at'])
                elif direction == 'in' and (gate_pass.movement_status == 'outside' or gate_pass.status in ['outside', 'used', 'out']):
                    now = timezone.now()
                    gate_pass.movement_status = 'returned'
                    gate_pass.actual_entry_at = now
                    gate_pass.entry_time = now
                    gate_pass.entry_security = request.user
                    if gate_pass.entry_date and now > gate_pass.entry_date:
                        gate_pass.status = 'late_return'
                    else:
                        gate_pass.status = 'returned'
                    gate_pass.save(update_fields=['status', 'movement_status', 'actual_entry_at', 'entry_time', 'entry_security', 'updated_at'])
            
            scan = GateScan.objects.create(
                student_id=resolved_student_id,
                gate_pass=gate_pass,
                direction=direction,
                qr_code=digital_qr or (gate_pass.qr_code if gate_pass else f"MANUAL_LOG_{timezone.now().timestamp()}"),
                location=location
            )

        # 4. Broadcast Events
        payload = {
            'id': scan.id,
            'student_id': scan.student_id,
            'direction': scan.direction,
            'scan_time': scan.scan_time.isoformat(),
            'location': scan.location,
            'verified': True, # It's verified because security logged it
            'resource': 'gate_scan',
        }

        # Notify Student
        broadcast_to_updates_user(scan.student_id, 'gate_scan_logged', payload)
        if gate_pass:
             broadcast_to_updates_user(
                 scan.student_id,
                 'gatepass_updated',
                 {
                     'id': gate_pass.id,
                     'status': gate_pass.status,
                     'movement_status': gate_pass.movement_status,
                 }
             )

        from websockets.broadcast import broadcast_to_management
        # Notify Staff/Security (Consolidated for performance)
        broadcast_to_management('gate_scan_logged', payload)
        
        serializer = self.get_serializer(scan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='scan_qr')
    def scan_qr(self, request):
        """Compatibility endpoint for FE scanner supporting direction='auto'."""
        digital_qr = request.data.get('digital_qr', '').strip()
        direction = request.data.get('direction', 'auto')

        if not digital_qr:
            return Response({'error': 'digital_qr is required'}, status=status.HTTP_400_BAD_REQUEST)

        if direction == 'auto':
            try:
                scanned_user = resolve_user_from_digital_qr(digital_qr, require_active=True)
            except DigitalQRValidationError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

            candidate_passes = GatePass.objects.filter(
                student=scanned_user,
                status__in=['approved', 'outside', 'used', 'out'],
            ).order_by('-exit_date', '-updated_at')
            if not candidate_passes.exists():
                return Response({'error': 'No eligible gate pass found for scanned user.'}, status=status.HTTP_404_NOT_FOUND)
            if candidate_passes.count() > 1:
                return Response(
                    {'error': 'Multiple active gate passes found for this student. Resolve pass conflict before scanning.'},
                    status=status.HTTP_409_CONFLICT,
                )
            gate_pass = candidate_passes.first()

            if gate_pass.status == 'approved':
                direction = 'out'
            elif gate_pass.movement_status == 'outside' or gate_pass.status in ['outside', 'used', 'out']:
                direction = 'in'
            else:
                return Response(
                    {'error': f'Cannot auto-detect direction for pass status: {gate_pass.status}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if direction not in ['in', 'out']:
            return Response({'error': 'Valid direction (in, out, or auto) required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            request.data['direction'] = direction
            request.data['digital_qr'] = digital_qr
        except Exception:
            # Fallback for immutable payloads
            mutable_data = request.data.copy()
            mutable_data['direction'] = direction
            mutable_data['digital_qr'] = digital_qr
            request._full_data = mutable_data

        return self.log_scan(request)
