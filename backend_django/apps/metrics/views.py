"""Metrics views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsWarden, IsSecurityHead
from core.role_scopes import get_warden_building_ids
from django.core.cache import cache
from django.db.models import Avg, Count, Max, Q
from django.utils import timezone
from datetime import date, timedelta, time
from .models import Metric
from .serializers import MetricSerializer
from apps.auth.models import User
from apps.rooms.models import Room, Bed, Building
from apps.gate_passes.models import GatePass, GateScan
from apps.attendance.models import Attendance
from apps.notices.models import Notice
from apps.messages.models import Message
from apps.meals.models import MealSpecialRequest
from core.services import get_attendance_stats


DASHBOARD_CACHE_TTL = 30
RECENT_ACTIVITY_CACHE_TTL = 15
CHEF_DAILY_CACHE_TTL = 10
ADVANCED_METRICS_CACHE_TTL = 20
SECURITY_STATS_CACHE_TTL = 30


class MetricViewSet(viewsets.ModelViewSet):
    """ViewSet for Metrics."""
    
    queryset = Metric.objects.all()
    serializer_class = MetricSerializer
    permission_classes = [IsAuthenticated, IsAdmin | IsWarden | IsSecurityHead]
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest metrics for each type."""
        latest_points = list(
            Metric.objects.values('metric_type').annotate(latest_timestamp=Max('timestamp'))
        )
        if not latest_points:
            return Response([])

        filters = Q()
        for row in latest_points:
            filters |= Q(metric_type=row['metric_type'], timestamp=row['latest_timestamp'])

        latest_metrics = Metric.objects.filter(filters).order_by('metric_type')
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
    global_key = "metrics:dashboard:global:v2"
    global_stats = cache.get(global_key)
    
    if not global_stats:
        from apps.complaints.models import Complaint
        from apps.leaves.models import LeaveApplication
        from apps.attendance.models import Attendance
        from apps.events.models import Event
        from apps.notices.models import Notice
        from apps.meals.models import MealSpecialRequest
        from datetime import time, date

        today = date.today()
        
        # OPTIMIZATION: Combine User and GatePass stats
        stats = User.objects.filter(role='student').aggregate(
            total_students=Count('id'),
            pending_gate_passes=Count('gate_passes', filter=Q(gate_passes__status='pending')),
            students_outside=Count('gate_passes', filter=Q(gate_passes__status='used')),
        )
        
        # OPTIMIZATION: Combine Complaint stats
        complaint_stats = Complaint.objects.aggregate(
            pending=Count('id', filter=Q(status__in=['open', 'in_progress'])),
            resolved=Count('id', filter=Q(status='resolved'))
        )
        
        # Room stats
        room_stats = Room.objects.aggregate(
            total_rooms=Count('id'),
            active_rooms=Count('id', filter=Q(current_occupancy__gt=0)),
            vacant_beds=Count('beds', filter=Q(beds__is_occupied=False))
        )
        
        # Other requests
        pending_leaves = LeaveApplication.objects.filter(status='PENDING_APPROVAL').count()
        pending_meal_requests = MealSpecialRequest.objects.filter(status='pending').count()
        
        active_leaves = LeaveApplication.objects.filter(
            Q(status='ACTIVE') | 
            Q(status='APPROVED', start_date__lte=today, end_date__gte=today)
        ).count()
        
        # New Metrics requested
        events_created = Event.objects.count()
        notices_sent = Notice.objects.count()
        
        # Attendance Reminder Logic
        now = timezone.now().astimezone(timezone.get_current_timezone())
        current_time = now.time()
        marking_start = time(19, 0) # 7 PM
        attendance_marked = Attendance.objects.filter(attendance_date=today).exists()
        
        show_attendance_alert = False
        if current_time >= marking_start and not attendance_marked:
            is_holiday = Event.objects.filter(
                is_holiday=True, 
                start_date__date__lte=today, 
                end_date__date__gte=today
            ).exists()
            if not is_holiday:
                show_attendance_alert = True

        today_attendance = Attendance.objects.filter(attendance_date=today, status='present').count()
        
        # COMPREHENSIVE PENDING CALCULATION
        total_pending_requests = (
            (stats['pending_gate_passes'] or 0) + 
            (complaint_stats['pending'] or 0) + 
            (pending_leaves or 0) + 
            (pending_meal_requests or 0)
        )
        
        global_stats = {
            'total_students': stats['total_students'] or 0,
            'students_inside': (stats['total_students'] or 0) - (stats['students_outside'] or 0),
            'students_outside': stats['students_outside'] or 0,
            'pending_gate_passes': stats['pending_gate_passes'] or 0,
            'pending_complaints': complaint_stats['pending'] or 0,
            'pending_leaves': pending_leaves or 0,
            'pending_meal_requests': pending_meal_requests or 0,
            'pending_requests': total_pending_requests or 0, # requested metric
            'closed_tickets': complaint_stats['resolved'] or 0, # requested metric
            'active_leaves': active_leaves or 0,
            'attendance_marked_today': attendance_marked,
            'show_attendance_alert': show_attendance_alert,
            'total_rooms': room_stats['total_rooms'] or 0,
            'active_rooms': room_stats['active_rooms'] or 0, # requested metric
            'occupied_rooms': room_stats['active_rooms'] or 0, # backward compat
            'vacant_beds': room_stats['vacant_beds'] or 0,
            'today_attendance': today_attendance or 0,
            'total_attendance': stats['total_students'] or 0,
            'events_created': events_created or 0, # requested metric
            'notices_sent': notices_sent or 0, # requested metric
        }
        cache.set(global_key, global_stats, DASHBOARD_CACHE_TTL)

    unread_key = f"metrics:dashboard:unread:{request.user.id}"
    unread_messages = cache.get(unread_key)
    if unread_messages is None:
        unread_messages = Message.objects.filter(recipient=request.user, is_read=False).count()
        cache.set(unread_key, unread_messages, 20)

    payload = global_stats.copy()
    payload['unread_messages'] = unread_messages
    
    # Student Specific Context
    if request.user.role == 'student':
        from apps.gate_passes.models import GatePass
        from apps.leaves.models import LeaveApplication
        from apps.attendance.models import Attendance
        
        active_gp = GatePass.objects.filter(student=request.user, status__in=['approved', 'used']).first()
        active_lv = LeaveApplication.objects.filter(student=request.user, status='approved', start_date__lte=today, end_date__gte=today).first()
        my_attendance = Attendance.objects.filter(user=request.user, attendance_date=today).first()
        
        payload.update({
            'my_gate_pass': {
                'id': active_gp.id,
                'status': active_gp.status,
                'destination': active_gp.destination
            } if active_gp else None,
            'my_leave': {
                'id': active_lv.id,
                'status': active_lv.status
            } if active_lv else None,
            'my_attendance_today': my_attendance.status if my_attendance else 'not_marked'
        })

    return Response(payload)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin | IsWarden])
def hostel_analytics(request):
    """
    Return comprehensive hostel-wide analytics.
    - Occupancy stats per building
    - Complaint distribution per building
    - Gate pass status per building
    - Leave statistics
    """
    from apps.complaints.models import Complaint
    from apps.leaves.models import LeaveApplication
    
    cache_key = f"metrics:analytics:{request.user.role}:{request.user.id}"
    cached_data = cache.get(cache_key)
    if cached_data:
        return Response(cached_data)

    buildings = Building.objects.all()
    if request.user.role == 'warden':
        warden_buildings = get_warden_building_ids(request.user)
        buildings = buildings.filter(id__in=warden_buildings)
    
    analytics = []
    for building in buildings:
        # Occupancy
        total_beds = Bed.objects.filter(room__building=building).count()
        occupied_beds = Bed.objects.filter(room__building=building, is_occupied=True).count()
        
        # Complaints
        complaints_count = Complaint.objects.filter(
            student__room_allocations__room__building=building,
            student__room_allocations__end_date__isnull=True
        ).distinct().count()
        
        # Gate Passes
        gps = GatePass.objects.filter(
            student__room_allocations__room__building=building,
            student__room_allocations__end_date__isnull=True
        ).distinct().aggregate(
            pending=Count('id', filter=Q(status='pending')),
            used=Count('id', filter=Q(status='used')),
            approved=Count('id', filter=Q(status='approved'))
        )
        
        analytics.append({
            'building_name': building.name,
            'total_beds': total_beds,
            'occupied_beds': occupied_beds,
            'occupancy_rate': round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0,
            'complaints_count': complaints_count,
            'gate_passes': gps
        })

    # Global Leave Stats
    from datetime import date
    today = date.today()
    leave_stats = LeaveApplication.objects.aggregate(
        active_today=Count('id', filter=Q(status='ACTIVE') | Q(status='APPROVED', start_date__lte=today, end_date__gte=today)),
        pending_total=Count('id', filter=Q(status='PENDING_APPROVAL'))
    )

    payload = {
        'hostel_wise_metrics': analytics,
        'global_leave_stats': leave_stats,
        'generated_at': timezone.now().isoformat()
    }
    
    cache.set(cache_key, payload, 60) # 1 minute cache
    return Response(payload)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def recent_activities(request):
    """Return a unified recent activity feed."""
    cache_key = f"metrics:recent_activities:{request.user.role}"
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return Response(cached_data)

    items = []
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

    special_requests = MealSpecialRequest.objects.select_related('student').order_by('-created_at')[:8].values(
        'id', 'item_name', 'status', 'created_at', 'student__username', 'student__first_name', 'student__last_name'
    )
    for sr in special_requests:
        name = f"{sr['student__first_name']} {sr['student__last_name']}".strip() or sr['student__username']
        items.append({
            'id': sr['id'],
            'type': 'special_request',
            'description': f"Special Request: {sr['item_name']} ({sr['status']}) for {name}",
            'timestamp': sr['created_at'],
            'user': name,
        })

    # DSA OPTIMIZATION: Only grab exactly what's needed to minimize RAM 
    # Use iterator() for memory efficiency if logs get large
    items.sort(key=lambda item: item['timestamp'] or timezone.now(), reverse=True)
    result = items[:20]
    
    # Store in cache with role-specific namespace
    cache.set(cache_key, result, RECENT_ACTIVITY_CACHE_TTL)
    
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chef_daily_stats(request):
    """Return real-time stats for the Chef."""
    from apps.meals.models import Meal, MealAttendance
    from datetime import time
    
    now = timezone.now().astimezone(timezone.get_current_timezone())
    current_time = now.time()
    today = now.date()
    cache_key = f"metrics:chef_daily:{today}:{current_time.hour}:{current_time.minute}"
    cached_payload = cache.get(cache_key)
    if cached_payload:
        return Response(cached_payload)
    
    MEAL_WINDOWS = [
        ('breakfast', time(7, 0), time(10, 30)),
        ('lunch', time(12, 0), time(15, 0)),
        ('snacks', time(16, 0), time(18, 0)),
        ('dinner', time(19, 0), time(22, 0)),
    ]
    
    current_meal_type = 'breakfast'
    for m_type, start, end in MEAL_WINDOWS:
        if current_time < end:
            current_meal_type = m_type
            break
    if current_time > MEAL_WINDOWS[-1][2]:
         current_meal_type = 'dinner'

    try:
        meal = Meal.objects.get(meal_date=today, meal_type=current_meal_type)
        attendance_totals = MealAttendance.objects.filter(meal=meal).aggregate(
            present_count=Count('id', filter=Q(status='taken')),
            skipped_count=Count('id', filter=Q(status='skipped')),
        )
        present_count = attendance_totals['present_count'] or 0
        skipped_count = attendance_totals['skipped_count'] or 0
    except Meal.DoesNotExist:
        meal = None
        present_count = 0
        skipped_count = 0
        
    total_students = User.objects.filter(role='student', is_active=True).count()
    students_on_leave = GatePass.objects.filter(
        Q(status='approved') | Q(status='used'),
        exit_date__lte=now
    ).filter(
        Q(entry_date__gte=now) | Q(entry_date__isnull=True)
    ).values('student').distinct().count()

    expected_students = total_students - students_on_leave
    if expected_students < 0: expected_students = 0
    
    not_eaten_count = expected_students - present_count - skipped_count
    if not_eaten_count < 0: not_eaten_count = 0

    payload = {
        'total_students': total_students,
        'students_out': students_on_leave,
        'expected_students': expected_students,
        'total_present': present_count,
        'total_skipped': skipped_count,
        'not_eaten': not_eaten_count,
        # Performance: Pre-calculated indicator
        'is_peak_load': expected_students > (total_students * 0.8),
        'total_absent': skipped_count + not_eaten_count,
        'meal_type': current_meal_type,
        'meal_date': today,
        'meal_id': meal.id if meal else None,
        'pending_special_requests': MealSpecialRequest.objects.filter(status='pending').count()
    }
    cache.set(cache_key, payload, CHEF_DAILY_CACHE_TTL)
    return Response(payload)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def advanced_dashboard_metrics(request):
    """Advanced metrics dashboard for specific roles."""
    user = request.user
    role = user.role
    period = request.query_params.get('period', 'week')
    today = date.today()
    
    if period == 'day':
        since = today
    elif period == 'month':
        since = today - timedelta(days=30)
    else:
        since = today - timedelta(days=7)

    cache_key = f"metrics:advanced:{user.id}:{role}:{period}"
    cached_payload = cache.get(cache_key)
    if cached_payload:
        return Response(cached_payload)

    # PHASE 5 Optimization: Simple locking to prevent parallel recompute (Free Tier protection)
    lock_key = f"metrics:advanced:lock:{user.id}:{role}:{period}"
    if not cache.add(lock_key, "locked", timeout=5):
        # Already being computed? Wait 1s and retry once
        import time
        time.sleep(1.5)
        cached_payload = cache.get(cache_key)
        if cached_payload:
            return Response(cached_payload)

    try:
        payload = {}
        
        if role in ['head_warden', 'admin', 'super_admin']:
            total_students = User.objects.filter(role='student', is_active=True).count()
            active_gate_passes = GatePass.objects.filter(status='used').count()
            
            from apps.leaves.models import LeaveApplication
            pending_leaves = LeaveApplication.objects.filter(status='PENDING_APPROVAL').count()
            
            total_beds = Bed.objects.count() or 1
            occupied_beds = Bed.objects.filter(is_occupied=True).count()
            occupancy_rate = round((occupied_beds / total_beds) * 100, 1)
            
            from apps.complaints.models import Complaint
            total_complaints = Complaint.objects.filter(created_at__date__gte=since).count() or 1
            resolved_complaints = Complaint.objects.filter(status='resolved', created_at__date__gte=since).count()
            resolution_rate = round((resolved_complaints / total_complaints) * 100, 1)
            
            students_out = GatePass.objects.filter(status='used').count()
            meal_forecast = total_students - students_out

            stale_leaves = GatePass.objects.filter(
                pass_type='leave',
                status='used',
                entry_date__lt=timezone.now()
            ).count()

            payload['head_warden_stats'] = {
                'total_students': total_students,
                'active_gate_passes': active_gate_passes,
                'pending_leaves': pending_leaves,
                'stale_leaves': stale_leaves,
                'pending_special_requests': MealSpecialRequest.objects.filter(status='pending').count(),
                'meal_forecast': meal_forecast,
                'occupancy_rate': occupancy_rate,
                'resolution_rate': resolution_rate,
                'period': period,
                'attendance_today': get_attendance_stats(today),
            }

        if role == 'chef':
            from apps.meals.models import MealAttendance
            daily_stats = chef_daily_stats(request).data
            
            trend_start = today - timedelta(days=6)
            attendance_rows = MealAttendance.objects.filter(
                meal__meal_date__range=(trend_start, today),
                status='taken'
            ).values('meal__meal_date').annotate(total=Count('id'))
            attendance_map = {row['meal__meal_date']: row['total'] for row in attendance_rows}

            leave_windows = list(
                GatePass.objects.filter(
                    status__in=['approved', 'used'],
                    exit_date__date__lte=today
                ).filter(
                    Q(entry_date__date__gte=trend_start) | Q(entry_date__isnull=True)
                ).values('exit_date', 'entry_date')
            )
            total_students = User.objects.filter(role='student', is_active=True).count()

            trend_data = []
            for i in range(7):
                d = today - timedelta(days=i)
                day_attendance = attendance_map.get(d, 0)
                day_gate_passes = sum(
                    1 for row in leave_windows
                    if row['exit_date'].date() <= d and (row['entry_date'] is None or row['entry_date'].date() >= d)
                )
                day_forecast = total_students - day_gate_passes
                
                trend_data.append({
                    'date': d.strftime('%Y-%m-%d'),
                    'attendance': day_attendance,
                    'forecast': day_forecast if day_forecast > 0 else 0
                })
            
            payload['chef_stats'] = {
                'daily': daily_stats,
                'trend': trend_data[::-1],
                # DSA: Rank requests by urgency (Today > Tomorrow > Later)
                'pending_priority_count': MealSpecialRequest.objects.filter(
                    status='pending', 
                    requested_for_date__lte=today + timedelta(days=1)
                ).count()
            }

        if role == 'warden':
            from apps.complaints.models import Complaint
            from apps.leaves.models import LeaveApplication
            warden_buildings = list(get_warden_building_ids(user))
            
            building_rows = Building.objects.filter(id__in=warden_buildings).annotate(
                total_beds=Count('rooms__beds', distinct=True),
                occupied_beds=Count('rooms__beds', filter=Q(rooms__beds__is_occupied=True), distinct=True),
            ).values('name', 'total_beds', 'occupied_beds')
            block_stats = [
                {
                    'building_name': row['name'],
                    'occupancy_rate': round(((row['occupied_beds'] or 0) / (row['total_beds'] or 1)) * 100, 1),
                    'total_beds': row['total_beds'] or 0,
                    'occupied_beds': row['occupied_beds'] or 0,
                }
                for row in building_rows
            ]
                
            pending_complaints = Complaint.objects.filter(
                status__in=['open', 'in_progress'],
                student__room_allocations__room__building__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).distinct().count()

            pending_leaves = LeaveApplication.objects.filter(
                status='PENDING_APPROVAL',
                student__room_allocations__room__building__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).distinct().count()

            gate_pass_counts = GatePass.objects.filter(
                status__in=['pending', 'approved', 'used'],
                student__room_allocations__room__building__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).values('status').annotate(total=Count('id', distinct=True))
            gp_status = {'pending': 0, 'approved': 0, 'used': 0}
            for row in gate_pass_counts:
                gp_status[row['status']] = row['total']

            stale_leaves = GatePass.objects.filter(
                pass_type='leave',
                status='used',
                entry_date__lt=timezone.now(),
                student__room_allocations__room__building__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).distinct().count()

            payload['warden_stats'] = {
                'block_occupancy': block_stats,
                'pending_complaints': pending_complaints,
                'pending_leaves': pending_leaves,
                'stale_leaves': stale_leaves,
                'pending_special_requests': MealSpecialRequest.objects.filter(
                    status='pending',
                    student__room_allocations__room__building__in=warden_buildings,
                    student__room_allocations__end_date__isnull=True
                ).distinct().count(),
                'gate_pass_status': gp_status,
                'attendance_marked_today': Attendance.objects.filter(attendance_date=today).exists(),
                'show_attendance_alert': (
                    timezone.now().astimezone(timezone.get_current_timezone()).time() >= time(19, 0) and 
                    not Attendance.objects.filter(attendance_date=today).exists() and
                    not (lambda: __import__('apps.events.models', fromlist=['Event']).Event.objects.filter(is_holiday=True, start_date__date__lte=today, end_date__date__gte=today).exists())()
                ),
                'attendance_today': get_attendance_stats(today),
            }

        if role == 'student':
            # Summary for student dashboard
            pending_requests = MealSpecialRequest.objects.filter(student=user, status='pending').count()
            approved_requests = MealSpecialRequest.objects.filter(student=user, status='approved').count()
            active_passes = GatePass.objects.filter(student=user, status__in=['approved', 'used']).count()
            
            payload['student_stats'] = {
                'pending_special_requests': pending_requests,
                'approved_special_requests': approved_requests,
                'active_gate_passes': active_passes,
            }

        cache.set(cache_key, payload, ADVANCED_METRICS_CACHE_TTL)
        return Response(payload)
    finally:
        cache.delete(lock_key)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsSecurityHead])
def security_stats(request):
    """Security-head dashboard stats."""
    cache_key = "metrics:security_head:v2"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    now = timezone.now()
    since = now - timedelta(hours=24)
    
    # PERFORMANCE OPTIMIZATION: Model counts are fast, but let's keep it clean
    total_scans_24h = GateScan.objects.filter(scan_time__gte=since).count()
    active_passes = GatePass.objects.filter(status__in=['approved', 'used']).count()
    on_duty_guards = User.objects.filter(role='gate_security', is_active=True).count()

    recent_scans_qs = GateScan.objects.select_related('student').order_by('-scan_time')[:10].values(
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
    stale_leaves = GatePass.objects.filter(pass_type='leave', status='used', entry_date__lt=timezone.now()).count()

    payload = {
        'total_scans_24h': total_scans_24h,
        'active_passes': active_passes,
        'students_outside': GatePass.objects.filter(status='used').count(),
        'stale_leaves': stale_leaves,
        'security_incidents': 0,
        'on_duty_guards': on_duty_guards,
        'recent_scans': recent_scans,
    }
    cache.set(cache_key, payload, SECURITY_STATS_CACHE_TTL)
    return Response(payload)



STUDENT_BUNDLE_TTL = 15


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_bundle(request):
    """
    Single batched endpoint for the student dashboard.
    Returns gate_passes, attendance_today, monthly_attendance, last_scan,
    notifications (3), and advanced_stats in one response.
    Cached for 15 seconds per student.
    """
    user = request.user
    if user.role != 'student':
        return Response({'detail': 'Student-only endpoint'}, status=status.HTTP_403_FORBIDDEN)

    cache_key = f"student:bundle:{user.id}"
    cached = cache.get(cache_key)
    if cached:
        return Response(cached)

    today = date.today()
    month_start = today.replace(day=1)

    # 1. Gate passes (recent 3 + aggregated counts)
    # Optimized: Batch counts into a single aggregation to save DB round-trips
    pass_stats = GatePass.objects.filter(student=user).aggregate(
        total_count=Count('id'),
        active_count=Count('id', filter=Q(status__in=['approved', 'used']))
    )
    
    # Optimized: select_related('approved_by') prevents N+1 queries when fetching full names
    passes = GatePass.objects.filter(student=user).select_related('approved_by').order_by('-created_at')[:3]
    gate_pass_recent = []
    for p in passes:
        gate_pass_recent.append({
            'id': p.id,
            'pass_type': p.pass_type,
            'status': p.status,
            'purpose': p.reason,
            'destination': p.destination,
            'exit_date': p.exit_date.date().isoformat() if p.exit_date else None,
            'exit_time': p.exit_date.time().strftime('%H:%M') if p.exit_date else None,
            'expected_return_date': p.entry_date.date().isoformat() if p.entry_date else None,
            'expected_return_time': p.entry_date.time().strftime('%H:%M') if p.entry_date else None,
            'created_at': p.created_at.isoformat() if p.created_at else None,
            'updated_at': p.updated_at.isoformat() if p.updated_at else None,
            'remarks': p.reason, # purpose
            'approval_remarks': getattr(p, 'approval_remarks', ''),
            'approved_by_name': p.approved_by.get_full_name() if p.approved_by else None,
            'parent_informed': p.parent_informed,
            'actual_exit_at': p.actual_exit_at.isoformat() if p.actual_exit_at else None,
            'actual_entry_at': p.actual_entry_at.isoformat() if p.actual_entry_at else None,
        })

    # 2. Today's attendance
    attendance_today = None
    att_qs = Attendance.objects.filter(user=user, attendance_date=today).first()
    if att_qs:
        attendance_today = {
            'status': att_qs.status,
            'check_in': att_qs.check_in_time.isoformat() if att_qs.check_in_time else None,
            'check_out': att_qs.check_out_time.isoformat() if att_qs.check_out_time else None,
        }

    # 3. Monthly attendance summary
    # BUGFIX: Corrected 'date' field name to 'attendance_date' as per model definition
    month_records = Attendance.objects.filter(user=user, attendance_date__gte=month_start, attendance_date__lte=today)
    total_days = month_records.count()
    status_breakdown = {}
    for rec in month_records.values('status').annotate(count=Count('id')):
        status_breakdown[rec['status']] = rec['count']

    # 4. Last gate scan
    last_scan_data = None
    last_scan_obj = GateScan.objects.filter(student=user).order_by('-scan_time').first()
    if last_scan_obj:
        last_scan_data = {
            'id': last_scan_obj.id,
            'direction': last_scan_obj.direction,
            'scan_time': last_scan_obj.scan_time.isoformat(),
            'location': getattr(last_scan_obj, 'location', ''),
        }

    # 5. Notifications (recent 3)
    from apps.notifications.models import Notification
    notifs = Notification.objects.filter(recipient=user).order_by('-created_at')[:3]
    notif_list = [{
        'id': n.id,
        'title': n.title,
        'message': n.message,
        'notification_type': n.notification_type,
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat(),
    } for n in notifs]

    # 6. Advanced stats (light)
    meal_stats = MealSpecialRequest.objects.filter(student=user).aggregate(
        pending=Count('id', filter=Q(status='pending')),
        approved=Count('id', filter=Q(status='approved'))
    )

    from apps.complaints.models import Complaint
    pending_complaints = Complaint.objects.filter(student=user, status__in=['open', 'in_progress']).count()
    active_passes = pass_stats['active_count']

    # 7. Profile minimal & Allocation
    from apps.rooms.models import RoomAllocation
    profile = {
        'hall_ticket': user.registration_number,
        'full_name': user.get_full_name(),
        'college_name': user.college.name if hasattr(user, 'college') and user.college else None,
    }
    room_alloc = RoomAllocation.objects.filter(student=user, status='approved', end_date__isnull=True).select_related('room', 'room__building').first()
    if room_alloc:
        profile['room_number'] = room_alloc.room.room_number
        profile['building_name'] = room_alloc.room.building.name if room_alloc.room.building else None
        profile['floor_number'] = room_alloc.room.floor

    # 8. Next Meal - FIX: Removed invalid 'available=True' and 'menu' field references
    from apps.meals.models import Meal
    from django.utils import timezone
    next_meal_obj = Meal.objects.filter(meal_date=today).first()
    
    next_meal_data = None
    if next_meal_obj:
        next_meal_data = {
            'id': next_meal_obj.id,
            'meal_type': next_meal_obj.meal_type,
            'menu': next_meal_obj.description, # Corrected from .menu
            'is_feedback_active': next_meal_obj.is_feedback_active,
            'feedback_prompt': next_meal_obj.feedback_prompt,
        }

    payload = {
        'profile': profile,
        'next_meal': next_meal_data,
        'gate_passes': {
            'count': pass_stats['total_count'],
            'recent': gate_pass_recent,
        },
        'attendance_today': attendance_today,
        'monthly_attendance': {
            'month': today.strftime('%Y-%m'),
            'total_days': total_days,
            'status_breakdown': status_breakdown,
        },
        'last_scan': last_scan_data,
        'notifications': notif_list,
        'advanced_stats': {
            'pending_special_requests': meal_stats['pending'],
            'approved_special_requests': meal_stats['approved'],
            'active_gate_passes': active_passes,
            'pending_complaints': pending_complaints,
        },
    }

    cache.set(cache_key, payload, STUDENT_BUNDLE_TTL)
    return Response(payload)
