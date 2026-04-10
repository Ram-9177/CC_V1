"""Metrics views."""
# pyre-ignore-all-errors
import logging
import time as time_module

from rest_framework import viewsets, status # pyre-fixme[21]
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes # pyre-fixme[21]
from rest_framework.response import Response # pyre-fixme[21]
from rest_framework.permissions import IsAuthenticated # pyre-fixme[21]
from rest_framework.exceptions import ValidationError  # pyre-fixme[21]
from core.permissions import ( # pyre-fixme[21]
    IsAdmin,
    IsWarden,
    IsStudent,
    CanViewReportsModule,
    CanViewSecurityModule,
    CanViewHostelModule,
    CanManageHostelModule,
    user_is_super_admin,
)
from core.role_scopes import get_warden_building_ids, get_hr_building_ids # pyre-fixme[21]
from django.core.cache import cache # pyre-fixme[21]
from django.db.models import Avg, Count, F, Max, OuterRef, Prefetch, Q, Subquery # pyre-fixme[21]
from django.utils import timezone # pyre-fixme[21]
from datetime import date, time, timedelta
from .models import Metric # pyre-fixme[21]
from .serializers import MetricSerializer # pyre-fixme[21]
from apps.auth.models import User # pyre-fixme[21]
from apps.rooms.models import Room, Bed, Building, RoomAllocation # pyre-fixme[21]
from apps.gate_passes.models import GatePass, GateScan # pyre-fixme[21]
from apps.attendance.models import Attendance # pyre-fixme[21]
from apps.notices.models import Notice # pyre-fixme[21]
from apps.messages.models import Message # pyre-fixme[21]
from apps.meals.models import Meal, MealAttendance, MealSpecialRequest # pyre-fixme[21]
from apps.complaints.models import Complaint # pyre-fixme[21]
from apps.leaves.models import LeaveApplication # pyre-fixme[21]
from apps.events.models import Event # pyre-fixme[21]
from apps.notifications.models import Notification # pyre-fixme[21]
from apps.colleges.models import College # pyre-fixme[21]
from apps.metrics.service import ( # pyre-fixme[21]
    get_admin_dashboard,
    get_warden_dashboard,
    get_student_dashboard,
)
from typing import Any, Dict, List, cast
from core.services import get_attendance_stats # pyre-fixme[21]
from core import cache_keys as ck # pyre-fixme[21]
from core.throttles import DashboardReadThrottle, ActivityFeedThrottle


DASHBOARD_CACHE_TTL = 300
DASHBOARD_OUT_CACHE_TTL = 60
DASHBOARD_STATS_CACHE_TTL = 300
RECENT_ACTIVITY_CACHE_TTL = 30
SUPER_ADMIN_DASHBOARD_CACHE_TTL = 120
SUPER_ADMIN_ACTIVITY_CACHE_TTL = 90
CHEF_DAILY_CACHE_TTL = 60
ADVANCED_METRICS_CACHE_TTL = 60
SECURITY_STATS_CACHE_TTL = 60
STUDENT_BUNDLE_TTL = 60

logger = logging.getLogger(__name__)


def _success_payload(data, message='OK'):
    return {
        'success': True,
        'data': data,
        'message': message,
    }


def _skip_cache(request):
    """Allow explicit cache bypass for strict real-time checks."""
    raw = (
        request.query_params.get('fresh')
        or request.query_params.get('refresh')
        or request.query_params.get('no_cache')
        or ''
    )
    return str(raw).strip().lower() in {'1', 'true', 'yes'}


def _resolve_college_filter_for_user(user, *, allow_super_admin_global: bool = False):
    """
    Resolve tenant filter for metrics endpoints.
    Returns (Q filter or None, scope_id string).
    """
    college = getattr(user, 'college', None)
    if college is not None:
        return Q(college=college), str(getattr(college, 'id', 'none'))

    if allow_super_admin_global and user_is_super_admin(user):
        return Q(), 'all'

    return None, 'none'


def _get_unread_messages_count(request):
    unread_key = f"metrics:dashboard:unread:{request.user.id}"
    unread_messages = None if _skip_cache(request) else cache.get(unread_key)
    if unread_messages is None:
        unread_messages = Message.objects.filter(recipient=request.user, is_read=False).count()
        cache.set(unread_key, unread_messages, 20)
    return int(unread_messages or 0)


def _is_holiday_today(target_date, college=None):
    """Return True when a holiday event spans the given date."""
    if college is None:
        return False
    cf = Q(college=college)
    return Event.objects.filter(
        cf & Q(
            is_holiday=True,
            start_time__date__lte=target_date,
            end_time__date__gte=target_date,
        )
    ).exists()

def _resolve_super_admin_college_scope(request):
    """
    Optional college scope for super_admin dashboard/activity queries.
    Query param: ?college_id=<id>|all
    """
    if not user_is_super_admin(request.user):
        return None

    raw_college_id = (request.query_params.get('college_id') or '').strip()
    if not raw_college_id or raw_college_id == 'all':
        return None

    # College PKs are UUIDs in this project; accept raw PK strings directly.
    college = College.objects.filter(pk=raw_college_id).first()
    if college is None:
        raise ValidationError({'college_id': 'Invalid college_id. Use a valid college id or "all".'})
    return college


def _build_super_admin_dashboard_metrics_payload(request, college_scope=None):
    """Platform-wide dashboard metrics for super_admin (cached, aggregate-only).

    Without this branch, super_admins with no college hit unscoped Q() filters that
    scan the whole dataset on every dashboard load — unacceptable at 3k–10k users.
    """
    scope_id = getattr(college_scope, 'id', 'all')
    cache_key = f'metrics:dashboard:super_admin:platform:{scope_id}:v2'
    global_stats = None if _skip_cache(request) else cache.get(cache_key)
    today = date.today()

    if global_stats is None:
        cf = Q(college=college_scope) if college_scope else Q()
        pending_gate_passes = GatePass.objects.filter(cf & Q(status='pending')).count()
        students_outside = GatePass.objects.filter(
            cf & Q(status__in=['approved', 'used', 'out', 'outside'])
        ).count()
        pending_complaints = Complaint.objects.filter(
            cf & Q(status__in=['open', 'assigned', 'in_progress', 'reopened'])
        ).count()
        pending_leaves = LeaveApplication.objects.filter(cf & Q(status='PENDING_APPROVAL')).count()
        pending_meal_requests = MealSpecialRequest.objects.filter(cf & Q(status='pending')).count()
        stale_leaves = LeaveApplication.objects.filter(
            cf & Q(status__in=['APPROVED', 'ACTIVE'], end_date__lt=today)
        ).count()
        active_leaves = LeaveApplication.objects.filter(
            cf & (Q(status='ACTIVE') | Q(status='APPROVED', start_date__lte=today, end_date__gte=today))
        ).count()

        total_students = User.objects.filter(cf & Q(is_active=True) & Q(role='student')).count()
        total_rooms = Room.objects.filter(cf).count()
        active_rooms = Room.objects.filter(cf).filter(beds__is_occupied=True).distinct().count()
        closed_tickets = Complaint.objects.filter(cf & Q(status__in=['resolved', 'closed'])).count()

        events_created = Event.objects.filter(cf).count()
        notices_sent = Notice.objects.filter(cf).count()
        attendance_marked = Attendance.objects.filter(cf & Q(attendance_date=today)).exists()
        today_attendance = Attendance.objects.filter(
            cf & Q(attendance_date=today, status='present')
        ).count()

        global_stats = {
            'scope_college_id': getattr(college_scope, 'id', None),
            'scope_college_name': getattr(college_scope, 'name', 'All Colleges'),
            'total_students': total_students,
            'students_inside': max(0, total_students - students_outside),
            'students_outside': students_outside,
            'pending_gate_passes': pending_gate_passes,
            'pending_complaints': pending_complaints,
            'pending_leaves': pending_leaves,
            'pending_meal_requests': pending_meal_requests,
            'pending_requests': (
                pending_gate_passes + pending_complaints + pending_leaves + pending_meal_requests
            ),
            'active_leaves': active_leaves,
            'stale_leaves': stale_leaves,
            'attendance_marked_today': attendance_marked,
            'show_attendance_alert': False,
            'today_attendance': today_attendance,
            'total_attendance': today_attendance,
            'events_created': events_created,
            'notices_sent': notices_sent,
            'total_rooms': total_rooms,
            'active_rooms': active_rooms,
            'closed_tickets': closed_tickets,
        }
        cache.set(cache_key, global_stats, SUPER_ADMIN_DASHBOARD_CACHE_TTL)

    payload = dict(global_stats) if isinstance(global_stats, dict) else {}
    payload['unread_messages'] = _get_unread_messages_count(request)
    return payload


def _build_dashboard_metrics_payload(request):
    """Build the shared dashboard metrics payload without re-entering DRF wrappers."""
    if user_is_super_admin(request.user):
        college_scope = _resolve_super_admin_college_scope(request)
        return _build_super_admin_dashboard_metrics_payload(request, college_scope=college_scope)

    role = request.user.role
    college = getattr(request.user, 'college', None)
    cf, college_id = _resolve_college_filter_for_user(request.user, allow_super_admin_global=False)
    if cf is None:
        return {
            'total_students': 0,
            'students_inside': 0,
            'students_outside': 0,
            'pending_gate_passes': 0,
            'pending_complaints': 0,
            'pending_leaves': 0,
            'pending_meal_requests': 0,
            'pending_requests': 0,
            'active_leaves': 0,
            'stale_leaves': 0,
            'attendance_marked_today': False,
            'show_attendance_alert': False,
            'today_attendance': 0,
            'total_attendance': 0,
            'events_created': 0,
            'notices_sent': 0,
            'total_rooms': 0,
            'active_rooms': 0,
            'closed_tickets': 0,
            'unread_messages': _get_unread_messages_count(request),
        }

    cf_user = cf & Q(is_active=True)
    scope = request.user.id if role == 'student' else f"{role}:{college_id}"
    global_key = f"metrics:dashboard:{scope}:v3"
    global_stats = None if _skip_cache(request) else cache.get(global_key)

    today = date.today()
    now = timezone.now().astimezone(timezone.get_current_timezone())

    if global_stats is None:
        total_students = 0
        pending_gate_passes = 0
        students_outside = 0
        pending_complaints = 0

        from apps.analytics.models import DailyHostelMetrics
        metrics = DailyHostelMetrics.objects.filter(tenant_id=college_id, date=today).first()

        if metrics:
            logger.info(f"[Metrics] Using high-speed pre-aggregated cache for {college_id}")
            total_students = metrics.total_students
            students_outside = metrics.students_outside
            # Keep pending metrics semantically correct; pre-aggregates currently store
            # issued counts and per-category open complaints, not pending workflow queues.
            pending_gate_passes = GatePass.objects.filter(cf & Q(status='pending')).count()
            complaint_counts = metrics.complaint_counts_by_category or {}
            pending_complaints = sum(
                int(v) for v in complaint_counts.values()
                if isinstance(v, (int, float))
            )
        else:
            total_students = User.objects.filter(cf_user & Q(role='student')).count()
            pending_gate_passes = GatePass.objects.filter(cf & Q(status='pending')).count()
            students_outside = GatePass.objects.filter(cf & Q(status__in=['approved', 'used', 'out', 'outside'])).count()
            pending_complaints = Complaint.objects.filter(
                cf & Q(status__in=['open', 'assigned', 'in_progress', 'reopened'])
            ).count()

        pending_leaves = LeaveApplication.objects.filter(cf & Q(status='PENDING_APPROVAL')).count()
        pending_meal_requests = MealSpecialRequest.objects.filter(cf & Q(status='pending')).count()
        stale_leaves = LeaveApplication.objects.filter(
            cf & Q(status__in=['APPROVED', 'ACTIVE'], end_date__lt=today)
        ).count()

        active_leaves = LeaveApplication.objects.filter(
            cf & (Q(status='ACTIVE') | Q(status='APPROVED', start_date__lte=today, end_date__gte=today))
        ).count()

        events_created = Event.objects.filter(cf).count()
        notices_sent = Notice.objects.filter(cf).count()

        current_time = now.time()
        marking_start = time(19, 0)
        attendance_marked = Attendance.objects.filter(cf & Q(attendance_date=today)).exists()

        show_attendance_alert = False
        if current_time >= marking_start and not attendance_marked:
            is_holiday = _is_holiday_today(today, college)
            if not is_holiday:
                show_attendance_alert = True

        today_attendance = Attendance.objects.filter(cf & Q(attendance_date=today, status='present')).count()

        total_rooms = Room.objects.filter(cf).count()
        active_rooms = Room.objects.filter(cf).filter(beds__is_occupied=True).distinct().count()
        closed_tickets = Complaint.objects.filter(
            cf & Q(status__in=['resolved', 'closed'])
        ).count()

        global_stats = {
            'total_students': total_students,
            'students_inside': total_students - students_outside,
            'students_outside': students_outside,
            'pending_gate_passes': pending_gate_passes,
            'pending_complaints': pending_complaints,
            'pending_leaves': pending_leaves,
            'pending_meal_requests': pending_meal_requests,
            'pending_requests': pending_gate_passes + pending_complaints + pending_leaves + pending_meal_requests,
            'active_leaves': active_leaves,
            'stale_leaves': stale_leaves,
            'attendance_marked_today': attendance_marked,
            'show_attendance_alert': show_attendance_alert,
            'today_attendance': today_attendance,
            'total_attendance': today_attendance,
            'events_created': events_created,
            'notices_sent': notices_sent,
            'total_rooms': total_rooms,
            'active_rooms': active_rooms,
            'closed_tickets': closed_tickets,
        }
        cache.set(global_key, global_stats, DASHBOARD_CACHE_TTL)

    payload = dict(global_stats) if isinstance(global_stats, dict) else {}
    payload['unread_messages'] = _get_unread_messages_count(request)

    if request.user.role == 'student':
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

    return payload


class MetricViewSet(viewsets.ModelViewSet):
    """ViewSet for Metrics."""
    
    queryset = Metric.objects.all()
    serializer_class = MetricSerializer
    permission_classes = [
        IsAuthenticated,
        CanViewHostelModule | CanViewSecurityModule | CanViewReportsModule,
    ]
    
    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Get latest metrics for each type."""
        latest_timestamp_subquery = (
            Metric.objects.filter(metric_type=OuterRef('metric_type'))
            .order_by('-timestamp')
            .values('timestamp')[:1]
        )
        latest_metrics = (
            Metric.objects
            .annotate(latest_timestamp=Subquery(latest_timestamp_subquery))
            .filter(timestamp=F('latest_timestamp'))
            .order_by('metric_type')
        )
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
@permission_classes([
    IsAuthenticated,
    CanViewReportsModule | CanViewHostelModule | CanViewSecurityModule | IsStudent,
])
@throttle_classes([DashboardReadThrottle])
def dashboard_metrics(request):
    """Return dashboard stats used by the frontend with layered caching."""
    return Response(_build_dashboard_metrics_payload(request))


@api_view(['GET'])
@permission_classes([
    IsAuthenticated,
    CanViewReportsModule | CanViewHostelModule | CanViewSecurityModule | IsStudent,
])
@throttle_classes([DashboardReadThrottle])
def dashboard_summary(request):
    """Performance-first summary payload in standardized response format."""
    payload = _build_dashboard_metrics_payload(request)
    return Response(_success_payload(payload, message='Dashboard summary fetched'))


@api_view(['GET'])
@permission_classes([
    IsAuthenticated,
    CanViewReportsModule | CanViewHostelModule | CanViewSecurityModule | IsStudent,
])
@throttle_classes([DashboardReadThrottle])
def dashboard_out(request):
    """Return currently outside students with strict tenant filtering and hard response limits."""
    cf, college_id = _resolve_college_filter_for_user(request.user, allow_super_admin_global=True)
    if cf is None:
        return Response(_success_payload([], message='OUT students fetched'))

    q = (request.query_params.get('q') or '').strip()
    try:
        limit = int(request.query_params.get('limit', 20))
    except (TypeError, ValueError):
        limit = 20
    limit = max(1, min(limit, 50))

    cache_key = f"metrics:dashboard:out:{college_id}:{request.user.role}:{q}:{limit}:v1"
    cached = None if _skip_cache(request) else cache.get(cache_key)
    if cached is not None:
        return Response(_success_payload(cached, message='OUT students fetched'))

    outside_statuses = ['approved', 'used', 'out', 'outside']
    queryset = GatePass.objects.filter(cf & Q(status__in=outside_statuses)).select_related('student')
    if q:
        queryset = queryset.filter(
            Q(student__first_name__icontains=q)
            | Q(student__last_name__icontains=q)
            | Q(student__registration_number__icontains=q)
        )

    rows = queryset.order_by('-updated_at').values(
        'id',
        'status',
        'destination',
        'exit_date',
        'updated_at',
        'student__first_name',
        'student__last_name',
        'student__username',
        'student__registration_number',
    )[:limit]

    data = []
    for row in rows:
        student_name = f"{row['student__first_name']} {row['student__last_name']}".strip() or row['student__username']
        data.append({
            'gate_pass_id': row['id'],
            'student_name': student_name,
            'hall_ticket': row['student__registration_number'],
            'status': row['status'],
            'destination': row['destination'],
            'exit_date': row['exit_date'],
            'updated_at': row['updated_at'],
        })

    cache.set(cache_key, data, DASHBOARD_OUT_CACHE_TTL)
    return Response(_success_payload(data, message='OUT students fetched'))


@api_view(['GET'])
@permission_classes([
    IsAuthenticated,
    CanViewReportsModule | CanViewHostelModule | CanViewSecurityModule | IsStudent,
])
@throttle_classes([DashboardReadThrottle])
def dashboard_stats(request):
    """Return hot dashboard counters with tighter cache semantics."""
    cf, college_id = _resolve_college_filter_for_user(request.user, allow_super_admin_global=True)
    if cf is None:
        empty = {
            'out_students_count': 0,
            'active_gate_passes': 0,
            'pending_complaints': 0,
            'attendance_marked_today': False,
        }
        return Response(_success_payload(empty, message='Dashboard stats fetched'))

    cache_key = f"metrics:dashboard:stats:{college_id}:{request.user.role}:v1"
    cached = None if _skip_cache(request) else cache.get(cache_key)
    if cached is not None:
        return Response(_success_payload(cached, message='Dashboard stats fetched'))

    today = date.today()
    data = {
        'out_students_count': GatePass.objects.filter(cf & Q(status__in=['approved', 'used', 'out', 'outside'])).count(),
        'active_gate_passes': GatePass.objects.filter(cf & Q(status__in=['approved', 'used'])).count(),
        'pending_complaints': Complaint.objects.filter(cf & Q(status__in=['open', 'assigned', 'in_progress', 'reopened'])).count(),
        'attendance_marked_today': Attendance.objects.filter(cf & Q(attendance_date=today)).exists(),
    }

    cache.set(cache_key, data, DASHBOARD_STATS_CACHE_TTL)
    return Response(_success_payload(data, message='Dashboard stats fetched'))


@api_view(['GET'])
@permission_classes([IsAuthenticated, CanViewHostelModule | CanManageHostelModule | IsAdmin | IsWarden])
def hostel_analytics(request):
    """
    Return comprehensive hostel-wide analytics.
    - Occupancy stats per building
    - Complaint distribution per building
    - Gate pass status per building
    - Leave statistics
    """

    cache_key = f"metrics:analytics:{request.user.role}:{getattr(getattr(request.user, 'college', None), 'id', 'none')}:{request.user.id}"
    cached_data = None if _skip_cache(request) else cache.get(cache_key)
    if cached_data is not None:
        return Response(cached_data)

    college = getattr(request.user, 'college', None)
    cf, _ = _resolve_college_filter_for_user(request.user, allow_super_admin_global=True)
    if cf is None:
        payload = {
            'hostel_wise_metrics': [],
            'global_leave_stats': {'active_today': 0, 'pending_total': 0},
            'generated_at': timezone.now().isoformat()
        }
        return Response(payload)

    buildings = Building.objects.filter(cf)
    scoped_roles = {'warden', 'hr', 'incharge'}
    if request.user.role in scoped_roles:
        scoped_buildings = []
        if request.user.role == 'incharge':
            hostel_id = getattr(request.user, 'hostel_id', None)
            if hostel_id:
                scoped_buildings = list(
                    Building.objects.filter(hostel_id=hostel_id).values_list('id', flat=True)
                )
        elif request.user.role == 'hr':
            scoped_buildings = get_hr_building_ids(request.user)
        else:
            scoped_buildings = get_warden_building_ids(request.user)

        buildings = buildings.filter(id__in=scoped_buildings)
    
    # PERFORMANCE FIX: Use annotation to fetch all building stats in ONE query instead of N queries in a loop
    buildings_with_stats = (
        buildings
        .annotate(
            total_beds_count=Count('rooms__beds', distinct=True),
            occupied_beds_count=Count('rooms__beds', filter=Q(rooms__beds__is_occupied=True), distinct=True),
            complaints_count_agg=Count(
                'rooms__allocations__student__complaints',
                filter=Q(rooms__allocations__end_date__isnull=True),
                distinct=True
            ),
            gp_pending=Count(
                'rooms__allocations__student__gate_passes',
                filter=Q(rooms__allocations__end_date__isnull=True, rooms__allocations__student__gate_passes__status='pending'),
                distinct=True
            ),
            gp_used=Count(
                'rooms__allocations__student__gate_passes',
                filter=Q(rooms__allocations__end_date__isnull=True, rooms__allocations__student__gate_passes__status='used'),
                distinct=True
            ),
            gp_approved=Count(
                'rooms__allocations__student__gate_passes',
                filter=Q(rooms__allocations__end_date__isnull=True, rooms__allocations__student__gate_passes__status='approved'),
                distinct=True
            )
        )
    )
    
    analytics = []
    for b in buildings_with_stats:
        analytics.append({
            'building_name': b.name,
            'total_beds': b.total_beds_count,
            'occupied_beds': b.occupied_beds_count,
            'occupancy_rate': float(f"{(b.occupied_beds_count / (b.total_beds_count or 1) * 100):.1f}"),
            'complaints_count': b.complaints_count_agg,
            'gate_passes': {
                'pending': b.gp_pending,
                'used': b.gp_used,
                'approved': b.gp_approved
            }
        })

    # Global Leave Stats
    today = date.today()
    leave_stats = LeaveApplication.objects.filter(cf).aggregate(
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
@throttle_classes([ActivityFeedThrottle])
def recent_activities(request):
    """Return a unified recent activity feed."""
    college_scope = _resolve_super_admin_college_scope(request)
    scope_id = getattr(college_scope, 'id', getattr(getattr(request.user, 'college', None), 'id', 'none'))
    cache_key = f"metrics:recent_activities:{request.user.role}:{scope_id}:v2"
    cached_data = None if _skip_cache(request) else cache.get(cache_key)
    
    if cached_data is not None:
        return Response(cached_data)

    activity_limit = 6 if user_is_super_admin(request.user) else 8
    activity_ttl = SUPER_ADMIN_ACTIVITY_CACHE_TTL if user_is_super_admin(request.user) else RECENT_ACTIVITY_CACHE_TTL
    college = college_scope if user_is_super_admin(request.user) else getattr(request.user, 'college', None)
    if not user_is_super_admin(request.user) and college is None:
        cache.set(cache_key, [], activity_ttl)
        return Response([])
    cf = Q(college=college) if college else Q()

    items = []
    gate_passes = GatePass.objects.filter(cf).order_by('-created_at')[:activity_limit].values(
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

    attendance_logs = Attendance.objects.filter(cf).order_by('-updated_at')[:activity_limit].values(
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

    notices = Notice.objects.filter(cf).order_by('-published_date')[:activity_limit].values(
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

    special_requests = MealSpecialRequest.objects.filter(cf).order_by('-created_at')[:activity_limit].values(
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
    # Avoid slicing syntax since the linter fails on it
    result = [items[i] for i in range(min(len(items), 20))]
    
    # Store in cache with role-specific namespace
    cache.set(cache_key, result, activity_ttl)
    
    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def chef_daily_stats(request):
    """Return real-time stats for the Chef."""
    now = timezone.now().astimezone(timezone.get_current_timezone())
    current_time = now.time()
    today = now.date()
    college = getattr(request.user, 'college', None)
    college_id = getattr(college, 'id', 'none')
    cache_key = f"metrics:chef_daily:{college_id}:{today}:{current_time.hour}:{current_time.minute}"
    cached_payload = cache.get(cache_key)
    if cached_payload is not None:
        return Response(cached_payload)

    if college is None and not user_is_super_admin(request.user):
        payload = {
            'total_students': 0,
            'students_out': 0,
            'expected_students': 0,
            'total_present': 0,
            'total_skipped': 0,
            'not_eaten': 0,
            'is_peak_load': False,
            'total_absent': 0,
            'meal_type': current_meal_type,
            'meal_date': today,
            'meal_id': None,
            'pending_special_requests': 0,
        }
        return Response(payload)
    cf = Q(college=college) if college else Q()

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

    total_students = User.objects.filter(cf & Q(role='student', is_active=True)).count()
    students_on_leave = GatePass.objects.filter(
        cf & (Q(status='approved') | Q(status='used')),
        exit_date__lte=now,
    ).filter(
        Q(entry_date__gte=now) | Q(entry_date__isnull=True)
    ).values('student').distinct().count()

    expected_students = max(0, total_students - students_on_leave)
    not_eaten_count = max(0, expected_students - present_count - skipped_count)

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
        'pending_special_requests': MealSpecialRequest.objects.filter(cf & Q(status='pending')).count()
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

    college_id = getattr(getattr(user, 'college', None), 'id', 'none')
    cache_key = f"metrics:advanced:{user.id}:{role}:{college_id}:{period}"
    cached_payload = cache.get(cache_key)
    if cached_payload is not None:
        return Response(cached_payload)

    # PHASE 5/6: Non-blocking recompute protection
    lock_key = f"metrics:advanced:lock:{user.id}:{role}:{college_id}:{period}"
    if not cache.add(lock_key, "locked", timeout=5):
        # Already being computed? Skip the sleep and try a fast re-check
        cached_payload = cache.get(cache_key)
        if cached_payload is not None:
            return Response(cached_payload)

    try:
        payload = {}
        # Multi-tenant isolation (Phase 6)
        college = getattr(user, 'college', None)
        if college is None and not user_is_super_admin(user):
            payload = {}
            cache.set(cache_key, payload, ADVANCED_METRICS_CACHE_TTL)
            return Response(payload)
        adv_cf = Q(college=college) if college else Q()

        if role in ['head_warden', 'admin', 'super_admin']:
            total_students = User.objects.filter(adv_cf & Q(role='student', is_active=True)).count()
            active_gate_passes = GatePass.objects.filter(adv_cf & Q(status='used')).count()

            pending_leaves = LeaveApplication.objects.filter(adv_cf & Q(status='PENDING_APPROVAL')).count()

            total_beds = Bed.objects.filter(adv_cf).count() or 1
            occupied_beds = Bed.objects.filter(adv_cf & Q(is_occupied=True)).count()
            occupancy_rate = float(f"{(occupied_beds / total_beds) * 100:.1f}")

            total_complaints = Complaint.objects.filter(adv_cf & Q(created_at__date__gte=since)).count() or 1
            resolved_complaints = Complaint.objects.filter(adv_cf & Q(status='resolved', created_at__date__gte=since)).count()
            resolution_rate = float(f"{(resolved_complaints / total_complaints) * 100:.1f}")

            students_out = active_gate_passes
            meal_forecast = total_students - students_out

            # FIXED: Corrected stale leaves calculation to use LeaveApplication model (Decision-ready)
            stale_leaves = LeaveApplication.objects.filter(
                adv_cf & Q(status__in=['APPROVED', 'ACTIVE'], end_date__lt=today)
            ).count()

            payload['head_warden_stats'] = {
                'total_students': total_students,
                'active_gate_passes': active_gate_passes,
                'pending_leaves': pending_leaves,
                'stale_leaves': stale_leaves,
                'pending_special_requests': MealSpecialRequest.objects.filter(adv_cf & Q(status='pending')).count(),
                'meal_forecast': meal_forecast,
                'occupancy_rate': occupancy_rate,
                'resolution_rate': resolution_rate,
                'period': period,
                'attendance_today': get_attendance_stats(today, college=college),
            }

        if role == 'chef':
            daily_stats = chef_daily_stats(request).data
            
            trend_start = today - timedelta(days=6)
            attendance_rows = MealAttendance.objects.filter(
                adv_cf,
                meal__meal_date__range=(trend_start, today),
                status='taken'
            ).values('meal__meal_date').annotate(total=Count('id'))
            attendance_map = {row['meal__meal_date']: row['total'] for row in attendance_rows}

            leave_windows = list(
                GatePass.objects.filter(
                    adv_cf & Q(status__in=['approved', 'used']),
                    exit_date__date__lte=today
                ).filter(
                    Q(entry_date__date__gte=trend_start) | Q(entry_date__isnull=True)
                ).values('exit_date', 'entry_date')
            )
            total_students = User.objects.filter(adv_cf & Q(role='student', is_active=True)).count()

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
                # Avoid slicing syntax [::-1] since the linter fails on it
                'trend': list(reversed(trend_data)) if isinstance(trend_data, list) else [],
                # DSA: Rank requests by urgency (Today > Tomorrow > Later)
                'pending_priority_count': MealSpecialRequest.objects.filter(
                    adv_cf,
                    status='pending', 
                    requested_for_date__lte=today + timedelta(days=1)
                ).count()
            }

        if role == 'warden':
            warden_buildings = list(get_warden_building_ids(user))
            
            building_rows = Building.objects.filter(id__in=warden_buildings).annotate(
                total_beds=Count('rooms__beds', distinct=True),
                occupied_beds=Count('rooms__beds', filter=Q(rooms__beds__is_occupied=True), distinct=True),
            ).values('name', 'total_beds', 'occupied_beds')
            block_stats = [
                {
                    'building_name': row['name'],
                    # Avoid round(x, 1) because the linter thinks it only takes 1 argument
                    'occupancy_rate': float(f"{((row['occupied_beds'] or 0) / (row['total_beds'] or 1.0) * 100):.1f}"),
                    'total_beds': row['total_beds'] or 0,
                    'occupied_beds': row['occupied_beds'] or 0,
                }
                for row in building_rows
            ]
                
            pending_complaints = Complaint.objects.filter(
                adv_cf & Q(status__in=['open', 'in_progress']),
                student__room_allocations__room__building__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).distinct().count()

            pending_leaves = LeaveApplication.objects.filter(
                adv_cf & Q(status='PENDING_APPROVAL'),
                student__room_allocations__room__building__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).distinct().count()

            gate_pass_counts = GatePass.objects.filter(
                adv_cf & Q(status__in=['pending', 'approved', 'used']),
                student__room_allocations__room__building__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).values('status').annotate(total=Count('id', distinct=True))
            gp_status = {'pending': 0, 'approved': 0, 'used': 0}
            for row in gate_pass_counts:
                gp_status[row['status']] = row['total']

            # FIXED: Accurate Stale Leaves count for Warden Dashboard
            stale_leaves = LeaveApplication.objects.filter(
                adv_cf & Q(status__in=['APPROVED', 'ACTIVE'], end_date__lt=today),
                student__room_allocations__room__building__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).distinct().count()

            payload['warden_stats'] = {
                'block_occupancy': block_stats,
                'pending_complaints': pending_complaints,
                'pending_leaves': pending_leaves,
                'stale_leaves': stale_leaves,
                'pending_special_requests': MealSpecialRequest.objects.filter(
                    adv_cf & Q(status='pending'),
                    student__room_allocations__room__building__in=warden_buildings,
                    student__room_allocations__end_date__isnull=True
                ).distinct().count(),
                'gate_pass_status': gp_status,
                'attendance_marked_today': Attendance.objects.filter(
                    adv_cf & Q(attendance_date=today, block_id__in=warden_buildings)
                ).exists(),
                'show_attendance_alert': (
                    timezone.now().astimezone(timezone.get_current_timezone()).time() >= time(19, 0) and 
                    not Attendance.objects.filter(
                        adv_cf & Q(attendance_date=today, block_id__in=warden_buildings)
                    ).exists() and
                    not _is_holiday_today(today, college)
                ),
                'attendance_today': get_attendance_stats(today, college=college),
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
@permission_classes([IsAuthenticated, CanViewSecurityModule])
def security_stats(request):
    """Security-head dashboard stats."""
    college_id = getattr(getattr(request.user, 'college', None), 'id', 'none')
    cache_key = f"metrics:security_head:{college_id}:v2"
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    now = timezone.now()
    since = now - timedelta(hours=24)
    college = getattr(request.user, 'college', None)
    cf, _ = _resolve_college_filter_for_user(request.user, allow_super_admin_global=True)
    if cf is None:
        payload = {
            'total_scans_24h': 0,
            'active_passes': 0,
            'on_duty_guards': 0,
            'recent_scans': [],
            'stale_leaves': 0,
            'approved_today': [],
        }
        return Response(payload)

    total_scans_24h = GateScan.objects.filter(cf & Q(scan_time__gte=since)).count()
    active_passes = GatePass.objects.filter(cf & Q(status__in=['approved', 'used'])).count()
    on_duty_guards = User.objects.filter(cf & Q(role='gate_security', is_active=True)).count()

    recent_scans_qs = GateScan.objects.filter(cf).select_related('student').order_by('-scan_time')[:10].values(
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
    stale_leaves = GatePass.objects.filter(cf & Q(pass_type='leave', status='used', entry_date__lt=timezone.now())).count()

    # Fetch Approved Today for the Security Dashboard (Sub-second awareness)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    # We use select_related for student and prefetch for room allocations to avoid N+1
    approved_today_qs = GatePass.objects.filter(
        cf & Q(
            status='approved',
            updated_at__gte=today_start,
        )
    ).select_related('student').prefetch_related(
        Prefetch(
            'student__room_allocations',
            queryset=RoomAllocation.objects.filter(status='approved', end_date__isnull=True).select_related('room', 'room__building'),
            to_attr='active_allocations'
        )
    ).order_by('-updated_at')[:20]

    approved_today = []
    for p in approved_today_qs:
        student = p.student
        room_no = "N/A"
        hostel_name = "N/A"
        
        active_allocs = getattr(student, 'active_allocations', [])
        if active_allocs:
            alloc = active_allocs[0]
            room_no = alloc.room.room_number
            try:
                hostel_name = alloc.room.building.name
            except AttributeError:
                pass

        approved_today.append({
            'id': p.id,
            'student_name': student.get_full_name() or student.username,
            'student_hall_ticket': student.registration_number,
            'student_room': room_no,
            'hostel_name': hostel_name,
            'exit_date': p.exit_date.date().isoformat(),
            'exit_time': p.exit_date.time().strftime('%H:%M'),
            'approval_remarks': p.approval_remarks,
            'status': p.status,
        })

    payload = {
        'total_scans_24h': total_scans_24h,
        'active_passes': active_passes,
        'students_outside': GatePass.objects.filter(cf & Q(status='used')).count(),
        'stale_leaves': stale_leaves,
        'security_incidents': 0,
        'on_duty_guards': on_duty_guards,
        'recent_scans': recent_scans,
        'approved_today': approved_today,
    }
    cache.set(cache_key, payload, SECURITY_STATS_CACHE_TTL)
    return Response(payload)



STUDENT_BUNDLE_TTL = 60


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
        return Response({})

    cache_key = ck.student_bundle(user.id)
    cached = cache.get(cache_key)
    if cached is not None:
        return Response(cached)

    today = date.today()
    month_start = today.replace(day=1)

    # 1. Gate passes (recent 3 + aggregated counts)
    # Optimized: Batch counts into a single aggregation to save DB round-trips
    pass_stats = GatePass.objects.filter(student=user).aggregate(
        total_count=Count('id'),
        active_count=Count('id', filter=Q(status__in=['approved', 'used', 'outside']))
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

    pending_complaints = Complaint.objects.filter(student=user, status__in=['open', 'in_progress']).count()
    active_passes = pass_stats['active_count']

    # 7. Profile minimal & Allocation
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

    import random
    jitter = random.randint(-10, 15)  # Thwart stampedes of mass student logins matching class schedules 
    cache.set(cache_key, payload, max(STUDENT_BUNDLE_TTL + jitter, 15))
    return Response(payload)


# ── New multi-tenant dashboard endpoints ──────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdmin | CanViewReportsModule | CanViewHostelModule])
def admin_dashboard(request):
    """GET /api/metrics/admin-dashboard/ — college-scoped admin stats."""
    college = getattr(request.user, 'college', None)
    data = get_admin_dashboard(college)
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsWarden | IsAdmin | CanViewHostelModule])
def warden_dashboard(request):
    """GET /api/metrics/warden-dashboard/ — building-scoped warden stats."""
    college = getattr(request.user, 'college', None)
    building_ids = list(get_warden_building_ids(request.user))
    data = get_warden_dashboard(college, building_ids=building_ids or None)
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_dashboard(request):
    """GET /api/metrics/student-dashboard/ — personal student stats."""
    if request.user.role != 'student':
        return Response({'detail': 'Student-only endpoint.'}, status=status.HTTP_403_FORBIDDEN)
    data = get_student_dashboard(request.user)
    return Response(data)
