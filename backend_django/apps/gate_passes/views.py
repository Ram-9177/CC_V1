"""Gate passes views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsWarden, IsAdmin, user_is_admin, user_is_staff
from django.utils import timezone
from .models import GatePass, GateScan
from .serializers import GatePassSerializer, GateScanSerializer
import uuid


class GatePassViewSet(viewsets.ModelViewSet):
    """ViewSet for Gate Pass management."""
    
    queryset = GatePass.objects.all()
    serializer_class = GatePassSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['approve', 'reject']:
            permission_classes = [IsAdmin | IsWarden]
        elif self.action == 'create':
            permission_classes = [IsAuthenticated]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        """Filter based on user role."""
        user = self.request.user
        queryset = GatePass.objects.all()

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        if user_is_admin(user) or user_is_staff(user):
            return queryset
        return queryset.filter(student=user)
    
    def create(self, request, *args, **kwargs):
        """Create a gate pass request."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(student=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a gate pass request."""
        gate_pass = self.get_object()
        gate_pass.status = 'approved'
        gate_pass.approved_by = request.user
        gate_pass.approval_remarks = request.data.get('remarks', '')
        gate_pass.save()
        
        serializer = self.get_serializer(gate_pass)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a gate pass request."""
        gate_pass = self.get_object()
        gate_pass.status = 'rejected'
        gate_pass.approved_by = request.user
        gate_pass.approval_remarks = request.data.get('remarks', '')
        gate_pass.save()
        
        serializer = self.get_serializer(gate_pass)
        return Response(serializer.data)
    
    @action(detail=True, methods=['get'])
    def generate_qr(self, request, pk=None):
        """Generate QR code for gate pass."""
        gate_pass = self.get_object()
        
        if gate_pass.status != 'approved':
            return Response({'error': 'Gate pass must be approved'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        qr_data = f"{gate_pass.id}_{uuid.uuid4().hex[:8]}"
        qr_path = generate_qrcode(qr_data, f'gate_pass_{gate_pass.id}')
        


class GateScanViewSet(viewsets.ModelViewSet):
    """ViewSet for Gate Scan logging."""
    
    queryset = GateScan.objects.all()
    serializer_class = GateScanSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Only gate staff and admin can create scans."""
        if self.action == 'create':
            permission_classes = [IsAdmin]  # Could add gate_staff role
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        """Filter based on user role."""
        user = self.request.user
        if user_is_admin(user) or user_is_staff(user):
            return GateScan.objects.all()
        return GateScan.objects.filter(student=user)
    
    @action(detail=False, methods=['post'])
    def scan_qr(self, request):
        """Process QR code scan."""
        qr_code = request.data.get('qr_code')
        direction = request.data.get('direction')  # 'in' or 'out'
        location = request.data.get('location', 'Main Gate')
        
        if not qr_code or not direction:
            return Response({'error': 'qr_code and direction required'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Try to find gate pass by QR code (simplified - in production use proper linking)
        gate_pass = GatePass.objects.filter(qr_code=qr_code).first()
        student = gate_pass.student if gate_pass else None
        
        scan = GateScan.objects.create(
            gate_pass=gate_pass,
            student=student,
            direction=direction,
            qr_code=qr_code,
            location=location
        )
        
        serializer = self.get_serializer(scan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
