"""Gate scans views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsWarden, IsGateStaff, user_is_admin, user_is_staff
from .models import GateScan
from .serializers import GateScanSerializer


class GateScanViewSet(viewsets.ModelViewSet):
    """ViewSet for Gate Scan logs."""
    
    queryset = GateScan.objects.all()
    serializer_class = GateScanSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Only admins can create logs."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdmin | IsWarden | IsGateStaff]
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
    def log_scan(self, request):
        """Log a gate scan."""
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
        
        serializer = self.get_serializer(scan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
