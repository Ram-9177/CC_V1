"""
Universal Architecture: BaseService Layer
Enforces uniform execution for all domain logic. Prevents business logic fragmentation.
"""
from typing import Any, Dict, List, Optional, Union
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.core.cache import cache
from datetime import datetime, date, time, timedelta
from core.event_bus_emitter import emit_event
from core.constants import (
    ROLE_ADMIN,
    ROLE_CHEF,
    ROLE_GATE_SECURITY,
    ROLE_HEAD_WARDEN,
    ROLE_SECURITY_HEAD,
    ROLE_STUDENT,
    ROLE_SUPER_ADMIN,
    ROLE_WARDEN,
)

_FORECAST_CACHE_TTL = 60 * 60 * 2  # 2 hours

def compute_dining_forecast(target_date: date, meal_type: Optional[str] = None, college_id: Optional[int] = None) -> dict:
    """
    Compute the expected diner count for target_date.
    Optimized version with caching and multi-tenant support.
    """
    from apps.auth.models import User
    from apps.gate_passes.models import GatePass
    from apps.attendance.models import Attendance
    from apps.leaves.models import LeaveApplication
    from apps.meals.models import MealAttendance

    cache_key = f"forecast_v4_{target_date.isoformat()}_{meal_type or 'all'}_{college_id or 'global'}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    tz = timezone.get_current_timezone()
    start_of_day = timezone.make_aware(datetime.combine(target_date, time.min), tz)
    end_of_day = timezone.make_aware(datetime.combine(target_date, time.max), tz)

    # Base Query with Tenant Isolation
    student_qs = User.objects.filter(role=ROLE_STUDENT, is_active=True)
    if college_id:
        student_qs = student_qs.filter(college_id=college_id)
    
    total_students = student_qs.count()

    # Exclusion A: GatePass
    gatepass_qs = GatePass.objects.filter(
        status__in=['approved', 'used'],
        exit_date__lt=end_of_day
    ).filter(
        Q(entry_date__gt=start_of_day) | Q(entry_date__isnull=True)
    )
    if college_id:
        gatepass_qs = gatepass_qs.filter(student__college_id=college_id)
    excluded_gatepass = set(gatepass_qs.values_list('student_id', flat=True))

    # Exclusion B: Approved Leave
    leave_qs = LeaveApplication.objects.filter(
        status='approved',
        start_date__lte=target_date,
        end_date__gte=target_date,
    )
    if college_id:
        leave_qs = leave_qs.filter(student__college_id=college_id)
    excluded_leave = set(leave_qs.values_list('student_id', flat=True))

    # Exclusion C: Marked Absent
    attendance_qs = Attendance.objects.filter(
        attendance_date=target_date,
        status='absent',
    )
    if college_id:
        attendance_qs = attendance_qs.filter(user__college_id=college_id)
    excluded_absent = set(attendance_qs.values_list('user_id', flat=True))

    # Exclusion D: Skipped Meal
    excluded_skipped_meal = set()
    if meal_type:
        meal_attendance_qs = MealAttendance.objects.filter(
            meal__meal_date=target_date,
            meal__meal_type=meal_type,
            status='skipped'
        )
        if college_id:
            meal_attendance_qs = meal_attendance_qs.filter(student__college_id=college_id)
        excluded_skipped_meal = set(meal_attendance_qs.values_list('student_id', flat=True))

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

def invalidate_forecast_cache(target_date: Optional[date] = None) -> None:
    """Invalidate forecast cache."""
    dates_to_clear = [target_date] if target_date else [date.today(), date.today() + timedelta(days=1)]
    for d in dates_to_clear:
        for version in ['v3', 'v4']:
            for mt in ['all', 'breakfast', 'lunch', 'dinner', 'snacks']:
                # Note: This doesn't account for college specific keys easily without college list
                cache.delete(f"forecast_{version}_{d.isoformat()}_{mt}_global")

def broadcast_gatepass_event(gatepass_id: int, student_id: int, status: str, action: Optional[str] = None) -> None:
    """
    Emit a minimal gatepass update event after DB commit.
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
        for role in (ROLE_GATE_SECURITY, ROLE_SECURITY_HEAD, ROLE_WARDEN, ROLE_HEAD_WARDEN, ROLE_ADMIN, ROLE_SUPER_ADMIN):
            broadcast_to_role(role, 'gatepass_updated', payload)
            
    transaction.on_commit(_emit)

def broadcast_attendance_event(student_id: int, attendance_date: date, status: str, block_id: Optional[int]) -> None:
    """
    Emit a minimal attendance update after DB commit.
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

def broadcast_forecast_refresh(target_date: Optional[date] = None) -> None:
    """
    Tell connected chef clients to refetch the forecast.
    """
    from websockets.broadcast import broadcast_to_role
    
    invalidate_forecast_cache(target_date)
    payload = {
        'date': (target_date or date.today()).isoformat(),
        'resource': 'forecast',
    }
    
    def _emit():
        broadcast_to_role(ROLE_CHEF, 'forecast_updated', payload)
        
    transaction.on_commit(_emit)

def get_attendance_stats(target_date: date, building_id: Optional[int] = None, floor: Optional[int] = None, college=None) -> dict:
    """
    Return attendance summary using a single aggregated DB query.
    """
    from apps.attendance.models import Attendance
    from apps.auth.models import User
    from django.db.models import Count

    qs = Attendance.objects.filter(attendance_date=target_date)
    if college is not None:
        qs = qs.filter(college=college)
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

    students_qs = User.objects.filter(role=ROLE_STUDENT, is_active=True)
    if college is not None:
        students_qs = students_qs.filter(college=college)
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

class BaseService:
    """
    Template pattern for all Domain Services (GatePass, Complaint, Hostel).
    Enforces atomic safety, strict validation, and event decoupling universally.
    """
    
    @classmethod
    def apply_college_scope(cls, instance: Any, actor: Any) -> Any:
        """
        Automatically stamps the actor's college_id onto the instance.
        Bypasses if actor is super_admin or model lacks college field.
        """
        if not actor or not instance:
            return instance

        is_super = getattr(actor, 'is_superuser', False) or getattr(actor, 'role', '') == 'super_admin'
        if is_super:
            return instance

        college = getattr(actor, 'college', None)
        if not college:
            return instance

        # Only inject if model has the field
        field_names = [f.name for f in instance._meta.get_fields()]
        if 'college' in field_names and not getattr(instance, 'college_id', None):
            instance.college = college
        
        return instance

    @classmethod
    def validate(cls, instance: Any, *args, **kwargs) -> None:
        """
        State Machine guard execution.
        Must raise an exception (e.g., core.exceptions.InvalidTransitionError) if illegal.
        """
        raise NotImplementedError("Subclasses must implement validate()")
        
    @classmethod
    @transaction.atomic
    def execute(cls, instance: Any, actor: Any, *args, **kwargs) -> Any:
        """
        1. Lock row to prevent race conditions.
        2. Auto-apply college scope from actor.
        3. Run cls.validate()
        4. Perform DB save() operations.
        5. Trigger cls.emit()
        """
        raise NotImplementedError("Subclasses must implement execute()")
        
    @classmethod
    def emit(cls, event_name: str, payload: Dict[str, Any], priority: str = 'medium') -> None:
        """
        Wrapper to push directly to the Transactional Event Outbox.
        """
        # We append trace_id tracking capability directly in the emission layer
        emit_event(name=event_name, payload=payload, priority=priority)
