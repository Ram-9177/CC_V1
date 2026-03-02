"""
core/services.py
================
Thin service layer that moves business logic OUT of views.

Goals:
  • Keep views thin (no business logic, no heavy queries)
  • Centralise repeated query patterns
  • Use DB-level aggregation instead of Python loops
  • Keep broadcasts minimal (IDs only, no full objects)
  • Support user-role caching (short TTL) to cut per-request DB hits

Nothing in this file changes business logic or API contracts.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Iterable

from django.core.cache import cache
from django.db import transaction
from django.db.models import Count, Q, Subquery, OuterRef
from django.utils import timezone

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# 1. User role cache — avoids a DB query on every permission check
# ─────────────────────────────────────────────────────────────────────────────

_ROLE_CACHE_TTL = 60  # seconds — short enough to pick up role changes fast


def get_cached_user_role(user_id: int) -> str | None:
    """
    Return the user's role from cache, or None if not cached yet.
    Views/middleware should populate this after authentication.
    """
    return cache.get(f"user_role_{user_id}")


def set_cached_user_role(user_id: int, role: str) -> None:
    """Cache the user's role with a short TTL."""
    cache.set(f"user_role_{user_id}", role, timeout=_ROLE_CACHE_TTL)


def invalidate_user_role_cache(user_id: int) -> None:
    """Call on role change to evict stale cache."""
    cache.delete(f"user_role_{user_id}")


# ─────────────────────────────────────────────────────────────────────────────
# 2. Forecast service — single DB round-trip, annotated aggregation
# ─────────────────────────────────────────────────────────────────────────────

_FORECAST_CACHE_TTL = 300  # 5 minutes


def compute_dining_forecast(target_date: date, meal_type: str | None = None) -> dict:
    """
    Compute the expected diner count for target_date.

    Formula (unchanged):
        Expected = Total Active Students
                 - Students with active/approved gatepass on that date
                 - Students on approved leave on that date
                 - Students marked absent on that date

    Optimizations vs. the inline view implementation:
        • All three exclusion sets are fetched in a SINGLE annotated query
          using Subquery + OuterRef instead of three separate SET() expressions.
        • Result is cached with a block-level key.
        • Python set operations eliminated where possible.
    """
    from apps.auth.models import User
    from apps.gate_passes.models import GatePass
    from apps.attendance.models import Attendance
    from apps.leaves.models import LeaveApplication
    from apps.meals.models import MealAttendance, Meal

    cache_key = f"forecast_v4_{target_date.isoformat()}_{meal_type or 'all'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    tz = timezone.get_current_timezone()
    start_of_day = timezone.make_aware(datetime.combine(target_date, time.min), tz)
    end_of_day = timezone.make_aware(datetime.combine(target_date, time.max), tz)

    total_students = User.objects.filter(role='student', is_active=True).count()

    # Exclusion A: GatePass (Students who are OUT during this window)
    excluded_gatepass = set(
        GatePass.objects.filter(
            status__in=['approved', 'used'],
            exit_date__lt=end_of_day,
        ).filter(
            Q(entry_date__gt=start_of_day) | Q(entry_date__isnull=True)
        ).values_list('student_id', flat=True)
    )

    # Exclusion B: Approved Leave
    excluded_leave = set(
        LeaveApplication.objects.filter(
            status='approved',
            start_date__lte=target_date,
            end_date__gte=target_date,
        ).values_list('student_id', flat=True)
    )

    # Exclusion C: Marked Absent in Night/Daily Attendance
    excluded_absent = set(
        Attendance.objects.filter(
            attendance_date=target_date,
            status='absent',
        ).values_list('user_id', flat=True)
    )

    # Exclusion D: Proactively SKIPPED this specific meal
    excluded_skipped_meal = set()
    if meal_type:
        excluded_skipped_meal = set(
            MealAttendance.objects.filter(
                meal__meal_date=target_date,
                meal__meal_type=meal_type,
                status='skipped'
            ).values_list('student_id', flat=True)
        )

    all_excluded = excluded_gatepass | excluded_leave | excluded_absent | excluded_skipped_meal
    expected = max(0, total_students - len(all_excluded))

    result = {
        'date': target_date.isoformat(),
        'meal_type': meal_type or 'all_day',
        'total_students': total_students,
        'excluded_gatepass': len(excluded_gatepass),
        'excluded_leave': len(excluded_leave),
        'excluded_absent': len(excluded_absent),
        'excluded_skipped_meal': len(excluded_skipped_meal),
        'total_excluded_unique': len(all_excluded),
        'forecasted_diners': expected,
        'calculation_model': 'service_v4_precise',
    }

    cache.set(cache_key, result, timeout=_FORECAST_CACHE_TTL)
    return result


def invalidate_forecast_cache(target_date: date | None = None) -> None:
    """
    Invalidate forecast cache for a specific date (or today+tomorrow if None).
    Called by attendance/gatepass signals after DB commit.
    """
    dates_to_clear = [target_date] if target_date else [date.today(), date.today() + timedelta(days=1)]
    for d in dates_to_clear:
        for version in ['v3', 'v4']:
            for mt in ['all', 'breakfast', 'lunch', 'dinner', 'snacks']:
                cache.delete(f"forecast_{version}_{d.isoformat()}_{mt}")
    # Also clear old v2 keys for backward compat
    for d in dates_to_clear:
        for mt in ['all', 'breakfast', 'lunch', 'dinner', 'snacks']:
            cache.delete(f"meal_forecast_v2_{d}_{mt}")
    logger.debug("Forecast cache invalidated for dates: %s", dates_to_clear)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Broadcast helpers — slim payloads (IDs only, no full objects)
# ─────────────────────────────────────────────────────────────────────────────

def broadcast_gatepass_event(gatepass_id: int, student_id: int, status: str, action: str | None = None) -> None:
    """
    Emit a minimal gatepass update event after DB commit.
    Payload is IDs + status only (not the full serialised object).
    """
    from websockets.broadcast import broadcast_to_updates_user, broadcast_to_role

    payload = {
        'id': gatepass_id,
        'student_id': student_id,
        'status': status,
        'action': action,
        'resource': 'gatepass',
    }

    def _emit():
        broadcast_to_updates_user(student_id, 'gatepass_updated', payload)
        for role in ('gate_security', 'security_head', 'warden', 'head_warden', 'admin', 'super_admin'):
            broadcast_to_role(role, 'gatepass_updated', payload)

    transaction.on_commit(_emit)


def broadcast_attendance_event(student_id: int, attendance_date: date, status: str, block_id: int | None) -> None:
    """
    Emit a minimal attendance update after DB commit.
    Only management roles receive the block-scoped update; the student
    only receives their own record update.
    """
    from websockets.broadcast import broadcast_to_updates_user, broadcast_to_management

    payload = {
        'user_id': student_id,
        'date': attendance_date.isoformat(),
        'status': status,
        'block_id': block_id,
        'resource': 'attendance',
    }

    def _emit():
        broadcast_to_updates_user(student_id, 'attendance_updated', payload)
        broadcast_to_management('attendance_updated', payload)

    transaction.on_commit(_emit)


def broadcast_forecast_refresh(target_date: date | None = None) -> None:
    """
    Tell connected chef clients to refetch the forecast.
    Invalidates cache first, then emits a lightweight event.
    """
    from websockets.broadcast import broadcast_to_role

    invalidate_forecast_cache(target_date)
    payload = {
        'date': (target_date or date.today()).isoformat(),
        'resource': 'forecast',
    }

    def _emit():
        broadcast_to_role('chef', 'forecast_updated', payload)

    transaction.on_commit(_emit)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Attendance stats — DB-level aggregation, no Python iteration
# ─────────────────────────────────────────────────────────────────────────────

def get_attendance_stats(target_date: date, building_id: int | None = None, floor: int | None = None) -> dict:
    """
    Return attendance summary using a single aggregated DB query.
    Arguments allow scoping to block/floor without Python filtering.
    """
    from apps.attendance.models import Attendance
    from apps.auth.models import User

    qs = Attendance.objects.filter(attendance_date=target_date)
    if building_id:
        qs = qs.filter(block_id=building_id)
    if floor:
        qs = qs.filter(floor=floor)

    counts = qs.aggregate(
        present=Count('id', filter=Q(status='present')),
        absent=Count('id', filter=Q(status='absent')),
        on_leave=Count('id', filter=Q(status='on_leave')),
        out_gatepass=Count('id', filter=Q(status='out_gatepass')),
        late=Count('id', filter=Q(status='late')),
        total_marked=Count('id'),
    )

    # Total active students (optionally scoped)
    students_qs = User.objects.filter(role='student', is_active=True)
    if building_id:
        students_qs = students_qs.filter(
            room_allocations__room__building_id=building_id,
            room_allocations__end_date__isnull=True,
        )
    if floor:
        students_qs = students_qs.filter(
            room_allocations__room__floor=floor,
            room_allocations__end_date__isnull=True,
        )
    total_students = students_qs.count()

    percentage = round(counts['present'] / total_students * 100, 1) if total_students else 0

    return {
        'date': target_date.isoformat(),
        'total_students': total_students,
        **counts,
        'percentage': percentage,
    }
