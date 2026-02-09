"""Metrics views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsWarden, IsSecurityHead
from django.db.models import Avg
from django.utils import timezone
from datetime import date, timedelta
from .models import Metric
from .serializers import MetricSerializer
from apps.auth.models import User
from apps.rooms.models import Room, RoomAllocation
from apps.rooms.models import Bed
from apps.gate_passes.models import GatePass, GateScan
# OLD: from apps.gate_scans.models import GateScan as GateScanLog
from apps.attendance.models import Attendance
from apps.notices.models import Notice
from apps.messages.models import Message


class MetricViewSet(viewsets.ModelViewSet):
    """ViewSet for Metrics."""
    
    queryset = Metric.objects.all()
    serializer_class = MetricSerializer
    permission_classes = [IsAuthenticated, IsAdmin | IsWarden | IsSecurityHead]
    
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
    total_students = User.objects.filter(role='student').count()
    total_rooms = Room.objects.count()
    occupied_rooms = Room.objects.filter(current_occupancy__gt=0).count()
    pending_gate_passes = GatePass.objects.filter(status='pending').count()
    vacant_beds = Bed.objects.filter(is_occupied=False).count()
    unread_messages = Message.objects.filter(recipient=request.user, is_read=False).count()

    today = date.today()
    today_attendance = Attendance.objects.filter(attendance_date=today, status='present').count()

    return Response({
        'total_students': total_students,
        'total_rooms': total_rooms,
        'occupied_rooms': occupied_rooms,
        'pending_gate_passes': pending_gate_passes,
        'vacant_beds': vacant_beds,
        'unread_messages': unread_messages,
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chef_daily_stats(request):
    """
    Return distinct stats for the Chef:
    - Total Students
    - Students Out (Currently outside based on GateScans)
    - Expected Students (Total - Out)
    """
    total_students = User.objects.filter(role='student').count()
    
    # Logic for finding students currently OUT
    # We look for the LATEST scan for each student. If it is 'out', they are out.
    
    # Subquery method is efficient for this:
    from django.db.models import OuterRef, Subquery
    
    # Use the gate_passes app as the canonical scan log (GateScan).
    latest_scans = GateScan.objects.filter(
        student=OuterRef('pk')
    ).order_by('-scan_time')
    
    students_out_count = User.objects.filter(
        role='student',
        gate_scans__isnull=False
    ).annotate(
        last_direction=Subquery(latest_scans.values('direction')[:1])
    ).filter(
        last_direction='out'
    ).count()
    
    expected_students = total_students - students_out_count
    
    return Response({
        'total_students': total_students,
        'students_out': students_out_count,
        'expected_students': expected_students
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSecurityHead])
def security_stats(request):
    """
    Security-head dashboard stats:
    - Total scans in last 24h
    - Active passes (approved/used)
    - Guards on duty (gate_security users)
    - Incidents proxy (unverified scans in last 24h)
    - Recent scan list (for quick monitoring)
    """
    now = timezone.now()
    since = now - timedelta(hours=24)

    # Use GateScan from gate_passes
    total_scans_24h = GateScan.objects.filter(scan_time__gte=since).count()
    # GateScan in gate_passes DOES NOT have verified. Assume 0 incidents for now.
    unverified_scans_24h = 0 
    active_passes = GatePass.objects.filter(status__in=['approved', 'used']).count()
    on_duty_guards = User.objects.filter(role='gate_security', is_active=True).count()

    recent_scans_qs = GateScan.objects.select_related('student').order_by('-scan_time')[:8]
    recent_scans = [
        {
            'id': scan.id,
            'student_name': scan.student.get_full_name() or scan.student.username,
            'student_hall_ticket': scan.student.registration_number,
            'direction': scan.direction,
            'location': scan.location or 'Main Gate',
            'scan_time': scan.scan_time,
            'verified': True, # Hardcoded as True for now
        }
        for scan in recent_scans_qs
    ]

    return Response({
        'total_scans_24h': total_scans_24h,
        'active_passes': active_passes,
        'security_incidents': unverified_scans_24h,
        'on_duty_guards': on_duty_guards,
        'recent_scans': recent_scans,
    })
