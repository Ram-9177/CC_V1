"""Gate scans views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import (
    IsAdmin, IsWarden, IsGateSecurity, IsSecurityHead, 
    user_is_admin, user_is_staff, SECURITY_ROLES, AUTHORITY_ROLES, ROLE_STUDENT
)
# Use the consolidated models from gate_passes app
from apps.gate_passes.models import GateScan, GatePass
# Removed unused BaseGateScanSerializer import
from websockets.broadcast import broadcast_to_role, broadcast_to_updates_user
from django.utils import timezone
from django.db import transaction

# Create a serializer that works with the new model if needed, 
# or import the one from gate_passes if compatible.
# For now, we'll import the one from gate_passes to match the model.
from apps.gate_passes.serializers import GateScanSerializer

class GateScanViewSet(viewsets.ModelViewSet):
    """ViewSet for Gate Scan logs (Unified)."""
    
    queryset = GateScan.objects.all()
    serializer_class = GateScanSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'log_scan']:
            # Security, security head, and admins have authority to log/modify scans
            return [IsAuthenticated(), (IsSecurityPersonnel | IsAdmin)()]
        else:
            # All authenticated users can read
            return [IsAuthenticated()]
    
    def get_queryset(self):
        """Filter based on user role and ownership."""
        user = self.request.user
        
        # Security personnel and management see all scans
        from django.db.models import Prefetch
        from apps.rooms.models import RoomAllocation

        base_qs = GateScan.objects.all()

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
            return GateScan.objects.filter(student=user).select_related('gate_pass')
        
        # Default: see own scans
        else:
            return GateScan.objects.filter(student=user)
    
    @action(detail=False, methods=['post'])
    def log_scan(self, request):
        """Log a gate scan and update GatePass status (Smart Scan)."""
        # Explicit check: gate_security, security_head, and admins can log scans
        from core.permissions import ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD
        if request.user.role not in [ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD] and not user_is_admin(request.user):
            return Response({'error': 'Only gate security personnel and admins can log scans.'}, status=status.HTTP_403_FORBIDDEN)
        
        student_id = request.data.get('student_id')
        direction = request.data.get('direction')
        qr_code = request.data.get('qr_code', '').strip()
        location = request.data.get('location', 'Main Gate')
        
        if not direction or direction not in ['in', 'out']:
             return Response({'error': 'Valid direction (in/out) required'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Try to find a GatePass by QR Code if provided
        gate_pass = None
        if qr_code:
            gate_pass = GatePass.objects.filter(qr_code=qr_code).first()
        
        # 2. If no QR or not found, try to find ACTIVE pass by Student ID
        if not gate_pass and student_id:
            if direction == 'out':
                 gate_pass = GatePass.objects.filter(student_id=student_id, status='approved').order_by('-exit_date').first()
            elif direction == 'in':
                 gate_pass = GatePass.objects.filter(student_id=student_id, status='used').order_by('-actual_exit_at').first()

        # 3. Determine the student
        resolved_student_id = None
        if gate_pass:
            resolved_student_id = gate_pass.student_id
        elif student_id:
            # Validate that the student exists
            from apps.auth.models import User
            if User.objects.filter(id=student_id, role='student').exists():
                resolved_student_id = student_id
            else:
                return Response({'error': 'Student not found with given ID'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'Could not identify student. Provide a valid QR code or student_id.'}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Create Scan Record & Update Pass
        with transaction.atomic():
            if gate_pass:
                gate_pass = GatePass.objects.select_for_update().get(id=gate_pass.id)
                
                if direction == 'out' and gate_pass.status == 'approved':
                    gate_pass.status = 'used'
                    gate_pass.actual_exit_at = timezone.now()
                    gate_pass.save(update_fields=['status', 'actual_exit_at', 'updated_at'])
                elif direction == 'in' and gate_pass.status == 'used':
                    gate_pass.status = 'expired'
                    gate_pass.actual_entry_at = timezone.now()
                    gate_pass.save(update_fields=['status', 'actual_entry_at', 'updated_at'])
            
            scan = GateScan.objects.create(
                student_id=resolved_student_id,
                gate_pass=gate_pass,
                direction=direction,
                qr_code=qr_code or (gate_pass.qr_code if gate_pass else f"MANUAL_LOG_{timezone.now().timestamp()}"),
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
             broadcast_to_updates_user(scan.student_id, 'gatepass_updated', {'id': gate_pass.id, 'status': gate_pass.status})

        from websockets.broadcast import broadcast_to_management
        # Notify Staff/Security (Consolidated for performance)
        broadcast_to_management('gate_scan_logged', payload)
        
        serializer = self.get_serializer(scan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
