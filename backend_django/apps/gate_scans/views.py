"""Gate scans views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import (
    IsAdmin, IsWarden, IsGateSecurity, IsSecurityHead, 
    user_is_admin, user_is_staff, SECURITY_ROLES, ROLE_STUDENT
)
# Use the consolidated models from gate_passes app
from apps.gate_passes.models import GateScan, GatePass
from apps.gate_scans.serializers import GateScanSerializer as BaseGateScanSerializer
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
            # Only security, gate security, and admins can create/modify logs
            return [IsAuthenticated(), (IsGateSecurity | IsSecurityHead | IsAdmin)()]
        else:
            # All authenticated users can read
            return [IsAuthenticated()]
    
    def get_queryset(self):
        """Filter based on user role and ownership."""
        user = self.request.user
        
        # Security personnel and management see all scans
        if user.role in SECURITY_ROLES or user_is_admin(user):
            return GateScan.objects.select_related('student', 'gate_pass').all()
        
        # Students see only their own scans
        elif user.role == ROLE_STUDENT:
            return GateScan.objects.filter(student=user).select_related('gate_pass')
        
        # Default: see own scans
        else:
            return GateScan.objects.filter(student=user)
    
    @action(detail=False, methods=['post'])
    def log_scan(self, request):
        """Log a gate scan and update GatePass status (Smart Scan)."""
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
            # If checking OUT, find approved pass. If checking IN, find used pass.
            if direction == 'out':
                 gate_pass = GatePass.objects.filter(student_id=student_id, status='approved').order_by('-exit_date').first()
            elif direction == 'in':
                 gate_pass = GatePass.objects.filter(student_id=student_id, status='used').order_by('-actual_exit_at').first()

        # 3. Create Scan Record & Update Pass
        with transaction.atomic():
            # If we found a pass, lock it and update status
            if gate_pass:
                # Refresh from DB with lock
                gate_pass = GatePass.objects.select_for_update().get(id=gate_pass.id)
                
                # Check constraints
                if direction == 'out' and gate_pass.status == 'approved':
                    gate_pass.status = 'used'
                    gate_pass.actual_exit_at = timezone.now()
                    gate_pass.save(update_fields=['status', 'actual_exit_at', 'updated_at'])
                elif direction == 'in' and gate_pass.status == 'used':
                    gate_pass.status = 'expired' # or 'completed'
                    gate_pass.actual_entry_at = timezone.now()
                    gate_pass.save(update_fields=['status', 'actual_entry_at', 'updated_at'])
            
            # Create the scan log (using the smart model)
            scan = GateScan.objects.create(
                student_id=student_id if student_id else (gate_pass.student_id if gate_pass else request.user.id),
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

        # Notify Staff/Security
        for role in ['staff', 'admin', 'super_admin', 'warden', 'head_warden', 'gate_security', 'security_head', 'chef']:
            broadcast_to_role(role, 'gate_scan_logged', payload)
        
        serializer = self.get_serializer(scan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
