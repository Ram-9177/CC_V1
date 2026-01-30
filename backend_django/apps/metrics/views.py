"""Metrics views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin
from django.db.models import Avg
from django.utils import timezone
from datetime import date
from .models import Metric
from .serializers import MetricSerializer
from apps.auth.models import User
from apps.rooms.models import Room, RoomAllocation
from apps.gate_passes.models import GatePass
from apps.attendance.models import Attendance
from apps.notices.models import Notice


class MetricViewSet(viewsets.ModelViewSet):
    """ViewSet for Metrics."""
    
    queryset = Metric.objects.all()
    serializer_class = MetricSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest metrics for each type."""
        metric_types = Metric.objects.values_list('metric_type', flat=True).distinct()
        latest_metrics = []
        
        for metric_type in metric_types:
            metric = Metric.objects.filter(metric_type=metric_type).latest('timestamp')
            latest_metrics.append(metric)
        
        serializer = self.get_serializer(latest_metrics, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def average(self, request):
        """Get average value for a metric type."""
        metric_type = request.query_params.get('metric_type')
        
        if not metric_type:
            return Response({'error': 'metric_type parameter required'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        avg_value = Metric.objects.filter(
            metric_type=metric_type
        ).aggregate(avg=Avg('value'))['avg']
        
        return Response({'metric_type': metric_type, 'average': avg_value})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_metrics(request):
    """Return dashboard stats used by the frontend."""
    total_students = User.objects.filter(groups__name='Student').count()
    total_rooms = Room.objects.count()
    occupied_rooms = Room.objects.filter(current_occupancy__gt=0).count()
    pending_gate_passes = GatePass.objects.filter(status='pending').count()

    today = date.today()
    today_attendance = Attendance.objects.filter(attendance_date=today, status='present').count()

    return Response({
        'total_students': total_students,
        'total_rooms': total_rooms,
        'occupied_rooms': occupied_rooms,
        'pending_gate_passes': pending_gate_passes,
        'today_attendance': today_attendance,
        'total_attendance': total_students,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_activities(request):
    """Return a unified recent activity feed."""
    items = []

    for gate_pass in GatePass.objects.select_related('student').order_by('-created_at')[:10]:
        items.append({
            'id': gate_pass.id,
            'type': 'gate_pass',
            'description': f"Gate pass {gate_pass.status} for {gate_pass.student.get_full_name() or gate_pass.student.username}",
            'timestamp': gate_pass.created_at,
            'user': gate_pass.student.get_full_name() or gate_pass.student.username,
        })

    for attendance in Attendance.objects.select_related('user').order_by('-updated_at')[:10]:
        items.append({
            'id': attendance.id,
            'type': 'attendance',
            'description': f"Attendance marked {attendance.status} for {attendance.user.get_full_name() or attendance.user.username}",
            'timestamp': attendance.updated_at,
            'user': attendance.user.get_full_name() or attendance.user.username,
        })

    for notice in Notice.objects.select_related('author').order_by('-published_date')[:10]:
        author_name = notice.author.get_full_name() if notice.author else 'System'
        items.append({
            'id': notice.id,
            'type': 'notice',
            'description': f"Notice created: {notice.title}",
            'timestamp': notice.published_date,
            'user': author_name,
        })

    items.sort(key=lambda item: item['timestamp'] or timezone.now(), reverse=True)

    payload = [
        {
            'id': item['id'],
            'type': item['type'],
            'description': item['description'],
            'timestamp': item['timestamp'],
            'user': item['user'],
        }
        for item in items[:20]
    ]

    return Response(payload)
