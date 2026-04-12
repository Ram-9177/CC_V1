"""Dashboard metrics service.

All functions return plain dicts built from aggregate queries only.
Max 8 DB hits per dashboard. Results are cached per college for 60 s.

Usage
-----
    from apps.metrics.service import get_admin_dashboard, get_warden_dashboard, get_student_dashboard

    data = get_admin_dashboard(college=request.user.college)
"""

import logging
import random
from django.core.cache import cache
from django.db.models import Count, Q
from django.utils import timezone

logger = logging.getLogger(__name__)

_TTL = 300  # 5 minutes for semi-static dashboards


def _cache_key(name: str, college_id) -> str:
    return f"metrics:{name}:{college_id}"


# ── Admin dashboard ───────────────────────────────────────────────────────────

def get_admin_dashboard(college) -> dict:
    """Aggregate stats for admin/head-warden dashboard."""
    cid = getattr(college, 'id', None)
    key = _cache_key('admin', cid)
    cached = cache.get(key)
    if cached is not None:
        return cached

    college_filter = Q(college=college) if college else Q()
    today = timezone.localdate()

    try:
        from apps.auth.models import User
        from apps.gate_passes.models import GatePass
        from apps.complaints.models import Complaint
        from apps.leaves.models import LeaveApplication

        user_counts = (
            User.objects
            .filter(college_filter & Q(is_active=True))
            .values('role')
            .annotate(count=Count('id'))
        )
        role_map = {r['role']: r['count'] for r in user_counts}

        gp_stats = (
            GatePass.objects
            .filter(college_filter)
            .values('status')
            .annotate(count=Count('id'))
        )
        gp_map = {r['status']: r['count'] for r in gp_stats}

        complaint_stats = (
            Complaint.objects
            .filter(college_filter)
            .values('status')
            .annotate(count=Count('id'))
        )
        comp_map = {r['status']: r['count'] for r in complaint_stats}

        leave_pending = (
            LeaveApplication.objects
            .filter(college_filter & Q(status='PENDING_APPROVAL'))
            .count()
        )

        outside_count = (
            GatePass.objects
            .filter(college_filter & Q(movement_status='outside'))
            .count()
        )

        data = {
            'users': {
                'total': sum(role_map.values()),
                'students': role_map.get('student', 0),
                'staff': sum(v for k, v in role_map.items() if k != 'student'),
            },
            'gate_passes': {
                'pending': gp_map.get('pending', 0),
                'approved': gp_map.get('approved', 0),
                'outside': outside_count,
                'today_exits': GatePass.objects.filter(
                    college_filter & Q(exit_time__date=today)
                ).count(),
            },
            'complaints': {
                'open': comp_map.get('open', 0),
                'in_progress': comp_map.get('in_progress', 0),
                'resolved': comp_map.get('resolved', 0),
            },
            'leaves': {
                'pending': leave_pending,
            },
            'generated_at': timezone.now().isoformat(),
        }
    except Exception as e:
        logger.error("get_admin_dashboard error: %s", e)
        data = {'error': str(e)}

    # Do not cache transient error payloads.
    if 'error' not in data:
        jitter = random.randint(-15, 15)
        cache.set(key, data, _TTL + jitter)
    return data


# ── Warden dashboard ──────────────────────────────────────────────────────────

def get_warden_dashboard(college, building_ids=None) -> dict:
    """Aggregate stats scoped to a warden's assigned buildings."""
    cid = getattr(college, 'id', None)
    bids_key = ','.join(str(b) for b in (building_ids or []))
    key = _cache_key(f'warden:{bids_key}', cid)
    cached = cache.get(key)
    if cached is not None:
        return cached

    college_filter = Q(college=college) if college else Q()
    today = timezone.localdate()

    try:
        from apps.gate_passes.models import GatePass
        from apps.complaints.models import Complaint
        from apps.attendance.models import Attendance

        scope = college_filter
        if building_ids:
            scope &= Q(student__room_allocations__room__building_id__in=building_ids,
                       student__room_allocations__end_date__isnull=True)

        gp_pending = GatePass.objects.filter(scope & Q(status='pending')).distinct().count()
        gp_outside = GatePass.objects.filter(scope & Q(movement_status='outside')).distinct().count()

        att_today = (
            Attendance.objects
            .filter(college_filter & Q(attendance_date=today))
            .values('status')
            .annotate(count=Count('id'))
        )
        att_map = {r['status']: r['count'] for r in att_today}

        comp_open = Complaint.objects.filter(scope & Q(status='open')).distinct().count()

        data = {
            'gate_passes': {'pending': gp_pending, 'outside': gp_outside},
            'attendance_today': {
                'present': att_map.get('present', 0),
                'absent': att_map.get('absent', 0),
                'on_leave': att_map.get('on_leave', 0),
            },
            'complaints': {'open': comp_open},
            'generated_at': timezone.now().isoformat(),
        }
    except Exception as e:
        logger.error("get_warden_dashboard error: %s", e)
        data = {'error': str(e)}

    if 'error' not in data:
        jitter = random.randint(-15, 15)
        cache.set(key, data, max(_TTL + jitter, 10))
    return data


# ── Student dashboard ─────────────────────────────────────────────────────────

def get_student_dashboard(user) -> dict:
    """Personal stats for a student — no college-wide aggregates."""
    key = _cache_key('student', user.id)
    cached = cache.get(key)
    if cached is not None:
        return cached

    try:
        from apps.gate_passes.models import GatePass
        from apps.leaves.models import LeaveApplication
        from apps.sports.models import SportBooking

        gp_stats = (
            GatePass.objects
            .filter(student=user)
            .values('status')
            .annotate(count=Count('id'))
        )
        gp_map = {r['status']: r['count'] for r in gp_stats}

        leave_active = LeaveApplication.objects.filter(
            student=user, status__in=['APPROVED', 'ACTIVE']
        ).count()

        sport_upcoming = SportBooking.objects.filter(
            student=user,
            status='confirmed',
            slot__date__gte=timezone.localdate(),
        ).count()

        data = {
            'gate_passes': {
                'pending': gp_map.get('pending', 0),
                'active': gp_map.get('approved', 0) + gp_map.get('outside', 0),
            },
            'leaves': {'active': leave_active},
            'sports': {'upcoming_bookings': sport_upcoming},
            'generated_at': timezone.now().isoformat(),
        }
    except Exception as e:
        logger.error("get_student_dashboard error: %s", e)
        data = {'error': str(e)}

    if 'error' not in data:
        cache.set(key, data, _TTL)
    return data
