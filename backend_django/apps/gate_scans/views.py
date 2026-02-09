"""Gate scans views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import (
    IsAdmin, IsWarden, IsGateSecurity, IsSecurityHead, 
    user_is_admin, user_is_staff, SECURITY_ROLES, ROLE_STUDENT
)
from .models import GateScan
from .serializers import GateScanSerializer
from websockets.broadcast import broadcast_to_role, broadcast_to_updates_user


class GateScanViewSet(viewsets.ModelViewSet):
    """ViewSet for Gate Scan logs."""
    
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
        if user.role in SECURITY_ROLES:
            return GateScan.objects.all()
        
        # Students see only their own scans
        elif user.role == ROLE_STUDENT:
            return GateScan.objects.filter(student=user)
        
        # Default: see own scans
        else:
            return GateScan.objects.filter(student=user)
    
    @action(detail=False, methods=['post'])
    def log_scan(self, request):
        """Log a gate scan with proper validation."""
        student_id = request.data.get('student_id')
        direction = request.data.get('direction')
        qr_code = request.data.get('qr_code')
        location = request.data.get('location', 'Main Gate')
        
        if not all([student_id, direction, qr_code]):
            return Response({'error': 'student_id, direction, qr_code required'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        scan = GateScan.objects.create(
            student_id=student_id,
            direction=direction,
            qr_code=qr_code,
            location=location,
            verified=True
        )

        payload = {
            'id': scan.id,
            'student_id': scan.student_id,
            'direction': scan.direction,
            'scan_time': scan.scan_time.isoformat(),
            'location': scan.location,
            'verified': scan.verified,
            'resource': 'gate_scan',
        }

        # Student gets their own scan event for live "last scan" / status updates.
        broadcast_to_updates_user(scan.student_id, 'gate_scan_logged', payload)

        # Monitoring roles get the same event.
        for role in ['staff', 'admin', 'super_admin', 'warden', 'head_warden', 'gate_security', 'security_head', 'chef']:
            broadcast_to_role(role, 'gate_scan_logged', payload)
        
        serializer = self.get_serializer(scan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
