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
    """Return dashboard stats used by the frontend with layered caching."""
    from django.core.cache import cache
    
    # 1. Fetch Global Stats (Cached for everyone)
    global_key = "dashboard_stats_global"
    global_stats = cache.get(global_key)
    
    if not global_stats:
        total_students = User.objects.filter(role='student').count()
        total_rooms = Room.objects.count()
        occupied_rooms = Room.objects.filter(current_occupancy__gt=0).count()
        pending_gate_passes = GatePass.objects.filter(status='pending').count()
        vacant_beds = Bed.objects.filter(is_occupied=False).count()
        
        today = date.today()
        today_attendance = Attendance.objects.filter(attendance_date=today, status='present').count()
        
        global_stats = {
            'total_students': total_students,
            'total_rooms': total_rooms,
            'occupied_rooms': occupied_rooms,
            'pending_gate_passes': pending_gate_passes,
            'vacant_beds': vacant_beds,
            'today_attendance': today_attendance,
            'total_attendance': total_students,
        }
        # Cache for 5 minutes (User agnostic)
        cache.set(global_key, global_stats, 300)

    # 2. Fetch User Specific Stats (No heavy caching needed or short cache)
    unread_messages = Message.objects.filter(recipient=request.user, is_read=False).count()

    # Merge
    payload = global_stats.copy()
    payload['unread_messages'] = unread_messages
    
    return Response(payload)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_activities(request):
    """Return a unified recent activity feed using values() for performance."""
    from django.core.cache import cache
    
    # Global cache for activities (same for everyone usually, unless filtered by role which isn't implemented here)
    cache_key = "recent_activities_feed"
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return Response(cached_data)

    items = []

    # Optimization: Use values() to avoid instantiating heavy Model objects
    gate_passes = GatePass.objects.select_related('student').order_by('-created_at')[:8].values(
        'id', 'status', 'created_at', 'student__username', 'student__first_name', 'student__last_name'
    )
    for gp in gate_passes:
        name = f"{gp['student__first_name']} {gp['student__last_name']}".strip() or gp['student__username']
        items.append({
            'id': gp['id'],
            'type': 'gate_pass',
            'description': f"Gate pass {gp['status']} for {name}",
            'timestamp': gp['created_at'],
            'user': name,
        })

    attendance_logs = Attendance.objects.select_related('user').order_by('-updated_at')[:8].values(
        'id', 'status', 'updated_at', 'user__username', 'user__first_name', 'user__last_name'
    )
    for att in attendance_logs:
        name = f"{att['user__first_name']} {att['user__last_name']}".strip() or att['user__username']
        items.append({
            'id': att['id'],
            'type': 'attendance',
            'description': f"Attendance marked {att['status']} for {name}",
            'timestamp': att['updated_at'],
            'user': name,
        })

    notices = Notice.objects.select_related('author').order_by('-published_date')[:8].values(
        'id', 'title', 'published_date', 'author__first_name', 'author__last_name', 'author__username'
    )
    for notice in notices:
        author = f"{notice['author__first_name']} {notice['author__last_name']}".strip() or notice['author__username'] or 'System'
        items.append({
            'id': notice['id'],
            'type': 'notice',
            'description': f"Notice: {notice['title']}",
            'timestamp': notice['published_date'],
            'user': author,
        })

    items.sort(key=lambda item: item['timestamp'] or timezone.now(), reverse=True)
    result = items[:20]
    
    # Cache for 1 minute (High traffic endpoint)
    cache.set(cache_key, result, 60)
    
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chef_daily_stats(request):
    """
    Return distinct stats for the Chef with 5min cache.
    """
    from django.core.cache import cache
    cache_key = "chef_daily_stats"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    total_students = User.objects.filter(role='student').count()
    from django.db.models import OuterRef, Subquery
    
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
    
    payload = {
        'total_students': total_students,
        'students_out': students_out_count,
        'expected_students': expected_students
    }
    cache.set(cache_key, payload, 300)
    return Response(payload)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSecurityHead])
def security_stats(request):
    """
    Security-head dashboard stats with optimized caching.
    """
    from django.core.cache import cache
    cache_key = "security_head_stats"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    now = timezone.now()
    since = now - timedelta(hours=24)

    total_scans_24h = GateScan.objects.filter(scan_time__gte=since).count()
    unverified_scans_24h = 0 
    active_passes = GatePass.objects.filter(status__in=['approved', 'used']).count()
    on_duty_guards = User.objects.filter(role='gate_security', is_active=True).count()

    recent_scans_qs = GateScan.objects.select_related('student').order_by('-scan_time')[:8].values(
        'id', 'student__first_name', 'student__last_name', 'student__username', 
        'student__registration_number', 'direction', 'location', 'scan_time'
    )
    recent_scans = [
        {
            'id': scan['id'],
            'student_name': f"{scan['student__first_name']} {scan['student__last_name']}".strip() or scan['student__username'],
            'student_hall_ticket': scan['student__registration_number'],
            'direction': scan['direction'],
            'location': scan['location'] or 'Main Gate',
            'scan_time': scan['scan_time'],
            'verified': True,
        }
        for scan in recent_scans_qs
    ]

    payload = {
        'total_scans_24h': total_scans_24h,
        'active_passes': active_passes,
        'security_incidents': unverified_scans_24h,
        'on_duty_guards': on_duty_guards,
        'recent_scans': recent_scans,
    }
    
    cache.set(cache_key, payload, 300) # 5 min cache
    return Response(payload)
