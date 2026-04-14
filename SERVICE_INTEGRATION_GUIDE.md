# Service Integration Guide - Using Resilience Mixins

This guide shows how to integrate break point recovery into existing Django services.

## Quick Start Examples

### Attendance Service (Read + Write)

**File**: `backend_django/apps/attendance/services.py`

```python
from django.db import transaction
from core.service_resilience import (
    ReadOnlyServiceMixin,
    WriteServiceMixin,
    with_resilience,
    SafeDatabase,
)
from .models import Attendance, AttendanceLog


class AttendanceService(WriteServiceMixin, ReadOnlyServiceMixin):
    """Attendance tracking with resilience."""
    
    CACHE_TTL = 3600  # 1 hour
    MAX_RETRIES = 3
    
    # ===== READ OPERATIONS (with cache) =====
    
    def get_user_attendance(self, user_id: int, college_id: int):
        """Get attendance record with cache fallback."""
        cache_key = self._get_cache_key('user_attendance', f'{user_id}:{college_id}')
        
        return self.get_with_cache(
            f'{user_id}:{college_id}',
            query_func=lambda uid: Attendance.objects.filter(
                student_id=uid,
                college_id=college_id
            ).first(),
            prefix='user_attendance'
        )
    
    def list_college_attendance(self, college_id: int, date=None):
        """List all attendance with cache fallback on pool exhaustion."""
        filters_str = f'{college_id}:{date or "all"}'
        
        def query():
            qs = Attendance.objects.filter(college_id=college_id)
            if date:
                qs = qs.filter(date=date)
            return list(qs.values('student_id', 'status', 'timestamp'))
        
        return self.list_with_cache(
            query_func=query,
            prefix='college_attendance'
        )
    
    # ===== WRITE OPERATIONS (with retry + cache invalidation) =====
    
    @with_resilience(max_retries=3)
    def mark_attendance(self, user_id: int, college_id: int, status='present', time=None):
        """Mark attendance with automatic retry on lock/exhaustion.
        
        Break points handled:
        - [BP2] Connection pool exhaustion → retries then fails gracefully
        - [BP6] Transaction lock → automatic exponential backoff retry
        """
        return self.create_with_resilience(
            Attendance,
            invalidate_patterns=['user_attendance', 'college_attendance', 'list'],
            student_id=user_id,
            college_id=college_id,
            status=status,
            timestamp=time or timezone.now()
        )
    
    def bulk_mark_attendance(self, attendances: list):
        """Mark attendance for multiple students with transaction protection.
        
        Args:
            attendances: [{'user_id': 1, 'college_id': 1, 'status': 'present', 'time': ...}, ...]
        """
        created = []
        failed = []
        
        with SafeDatabase() as db:
            for att in attendances:
                try:
                    obj = self.mark_attendance(
                        att['user_id'],
                        att['college_id'],
                        att.get('status', 'present'),
                        att.get('time')
                    )
                    created.append(obj)
                except Exception as e:
                    failed.append({'data': att, 'error': str(e)})
        
        return {
            'created': len(created),
            'failed': len(failed),
            'failures': failed,
        }
    
    def update_attendance(self, obj_id: int, **kwargs):
        """Update attendance record with cache invalidation."""
        try:
            obj = Attendance.objects.get(id=obj_id)
            return self.update_with_resilience(
                obj,
                invalidate_patterns=['user_attendance', 'college_attendance', 'list'],
                **kwargs
            )
        except Attendance.DoesNotExist:
            raise ValidationError(f"Attendance {obj_id} not found")
    
    # ===== SPECIAL OPERATIONS =====
    
    def get_late_arrivals(self, college_id: int, building_id: int, window_minutes=30):
        """Get late arrivals for a building with cache.
        
        [BP3] Redis down → cache miss → falls back to DB query
        """
        cache_key = self._get_cache_key('late_arrivals', f'{college_id}:{building_id}')
        
        def query():
            from django.utils import timezone
            from datetime import timedelta
            
            # Get building's attendance window
            from apps.hostels.models import Building
            building = Building.objects.get(id=building_id, college_id=college_id)
            
            # Find students who marked attendance after window
            cutoff = building.attendance_time + timedelta(minutes=window_minutes)
            return list(
                Attendance.objects.filter(
                    college_id=college_id,
                    timestamp__gt=cutoff,
                    timestamp__date=timezone.now().date()
                ).select_related('student')
            )
        
        result, source = self._get_or_query(cache_key, query)
        print(f"Late arrivals from {source}")
        return result
    
    # ===== DIAGNOSTICS =====
    
    def health_check(self):
        """Check service health for monitoring."""
        from core.connection_resilience import DBHealthCheck, RedisHealthCheck
        
        return {
            'service': 'attendance',
            'database': DBHealthCheck.is_healthy(),
            'cache': RedisHealthCheck.is_healthy(),
            'pool_status': {
                'status': 'healthy' if DBHealthCheck.is_healthy() else 'unhealthy',
            }
        }
```

---

### Complaint Service (Write-Heavy)

**File**: `backend_django/apps/complaints/services.py`

```python
from core.service_resilience import WriteServiceMixin, with_resilience
from .models import Complaint, ComplaintResolution


class ComplaintService(WriteServiceMixin):
    """Submit and resolve complaints with resilience."""
    
    CACHE_TTL = 1800  # 30 minutes
    MAX_RETRIES = 3
    
    @with_resilience(max_retries=3, use_cache=True, cache_ttl=1800)
    def create_complaint(self, user_id: int, college_id: int, title: str, description: str, category: str):
        """Create complaint with automatic retry on deadlock.
        
        [BP6] Transaction lock → auto-retry with exponential backoff
        """
        return self.create_with_resilience(
            Complaint,
            invalidate_patterns=['user_complaints', 'college_complaints'],
            user_id=user_id,
            college_id=college_id,
            title=title,
            description=description,
            category=category,
            status='open'
        )
    
    @with_resilience(max_retries=3)
    def resolve_complaint(self, complaint_id: int, resolution: str, assigned_to_id: int = None):
        """Resolve complaint with cache invalidation."""
        try:
            complaint = Complaint.objects.get(id=complaint_id)
            return self.update_with_resilience(
                complaint,
                status='resolved',
                resolution=resolution,
                assigned_to_id=assigned_to_id,
                invalidate_patterns=['user_complaints', 'college_complaints', 'detail']
            )
        except Complaint.DoesNotExist:
            raise ValidationError(f"Complaint {complaint_id} not found")
    
    def list_pending_complaints(self, college_id: int, assigned_to_id: int = None):
        """List pending complaints with cache.
        
        [BP2] Pool exhaustion → cache fallback to recent data
        [BP3] Redis down → direct DB query
        """
        cache_key = self._get_cache_key('pending', f'{college_id}:{assigned_to_id}')
        
        def query():
            qs = Complaint.objects.filter(college_id=college_id, status='open')
            if assigned_to_id:
                qs = qs.filter(assigned_to_id=assigned_to_id)
            return list(qs.values('id', 'title', 'created_at', 'category'))
        
        result, source = self._get_or_query(cache_key, query)
        print(f"Loaded {len(result)} pending complaints from {source}")
        return result
```

---

### Room Allocation Service (Complex)

**File**: `backend_django/apps/rooms/services.py`

```python
from django.db import transaction
from core.service_resilience import ResilientServiceMixin, with_resilience
from .models import Room, RoomAllocation


class RoomAllocationService(ResilientServiceMixin):
    """Allocate rooms to students with transaction protection."""
    
    MAX_RETRIES = 5  # Higher for allocation (more contention)
    CACHE_TTL = 7200  # 2 hours
    
    @transaction.atomic
    @with_resilience(max_retries=5)
    def allocate_room(self, user_id: int, room_id: int, college_id: int, start_date=None):
        """Allocate room to student with transaction lock retry.
        
        [BP6] Transaction deadlock → auto-retry with longer backoff
        """
        try:
            # Check room availability
            existing = RoomAllocation.objects.filter(
                room_id=room_id,
                college_id=college_id,
                status='active'
            ).exists()
            
            if existing:
                raise ValidationError("Room already allocated")
            
            # Create allocation with retry on deadlock
            allocation = self._execute_with_retry(
                lambda: RoomAllocation.objects.create(
                    student_id=user_id,
                    room_id=room_id,
                    college_id=college_id,
                    start_date=start_date or timezone.now().date(),
                    status='active'
                )
            )
            
            # Update room occupancy
            room = Room.objects.get(id=room_id)
            room.current_occupancy = (room.current_occupancy or 0) + 1
            room.save(update_fields=['current_occupancy'])
            
            # Invalidate related caches
            self._invalidate_cache('available_rooms')
            self._invalidate_cache(f'student_room:{user_id}')
            
            return allocation
        
        except IntegrityError as e:
            raise ValidationError(f"Room allocation conflict: {e}")
    
    @transaction.atomic
    @with_resilience(max_retries=3)
    def deallocate_room(self, allocation_id: int):
        """Remove room allocation with automatic rollback on error."""
        allocation = RoomAllocation.objects.get(id=allocation_id)
        
        try:
            # Update room
            room = allocation.room
            room.current_occupancy = max(0, (room.current_occupancy or 1) - 1)
            room.save(update_fields=['current_occupancy'])
            
            # Mark as inactive
            allocation.status = 'inactive'
            allocation.end_date = timezone.now().date()
            allocation.save()
            
            # Invalidate cache
            self._invalidate_cache('available_rooms')
            self._invalidate_cache(f'student_room:{allocation.student_id}')
            
            return allocation
        
        except Exception as e:
            # Transaction auto-rolls back due to @transaction.atomic
            raise
    
    def get_available_rooms(self, college_id: int, building_id: int = None, capacity_min: int = 1):
        """List available rooms with cache.
        
        [BP2] Pool exhaustion → falls back to cached results (may be stale)
        """
        filters = f'{college_id}:{building_id}:{capacity_min}'
        cache_key = self._get_cache_key('available', filters)
        
        def query():
            qs = Room.objects.filter(
                college_id=college_id,
                capacity__gte=capacity_min
            ).exclude(
                roomenrollment__status='active'
            )
            
            if building_id:
                qs = qs.filter(building_id=building_id)
            
            return list(qs.values('id', 'room_number', 'capacity', 'current_occupancy'))
        
        result, source = self._get_or_query(cache_key, query, ttl=self.CACHE_TTL)
        return result
    
    def get_allocation_status(self, user_id: int, college_id: int):
        """Get student's room allocation with cache."""
        def query():
            allocation = RoomAllocation.objects.filter(
                student_id=user_id,
                college_id=college_id,
                status='active'
            ).select_related('room').first()
            
            if allocation:
                return {
                    'allocated': True,
                    'room_id': allocation.room_id,
                    'room_number': allocation.room.room_number,
                    'block': allocation.room.block,
                    'floor': allocation.room.floor,
                }
            return {'allocated': False}
        
        cache_key = self._get_cache_key('status', f'{user_id}:{college_id}')
        result, source = self._get_or_query(cache_key, query, ttl=3600)
        return result
```

---

### Gate Pass Service (Real-Time)

**File**: `backend_django/apps/gate_passes/services.py`

```python
from core.service_resilience import WriteServiceMixin, with_resilience
from core.websocket_resilience import WebSocketQueueManager
from .models import GatePass


class GatePassService(WriteServiceMixin):
    """Issue and track gate passes with real-time updates."""
    
    MAX_RETRIES = 3
    CACHE_TTL = 900  # 15 minutes (frequent changes)
    
    @with_resilience(max_retries=3)
    def create_gate_pass(self, user_id: int, college_id: int, reason: str, duration_hours: int, warden_id: int = None):
        """Create gate pass with automatic retry.
        
        [BP6] Transaction lock → retry (likely high contention at night)
        """
        gate_pass = self.create_with_resilience(
            GatePass,
            invalidate_patterns=['user_passes', 'pending_approvals'],
            student_id=user_id,
            college_id=college_id,
            reason=reason,
            issued_at=timezone.now(),
            valid_until=timezone.now() + timedelta(hours=duration_hours),
            warden_id=warden_id,
            status='approved'
        )
        
        # Broadcast via WebSocket
        self._broadcast_update('gate_pass_created', {
            'user_id': user_id,
            'pass_id': gate_pass.id,
            'valid_until': gate_pass.valid_until.isoformat(),
        })
        
        return gate_pass
    
    @with_resilience(max_retries=3)
    def revoke_gate_pass(self, pass_id: int):
        """Revoke gate pass immediately."""
        try:
            gate_pass = GatePass.objects.get(id=pass_id)
            return self.update_with_resilience(
                gate_pass,
                status='revoked',
                invalidate_patterns=['user_passes', 'pending_approvals']
            )
        finally:
            # Broadcast revocation even if update fails
            self._broadcast_update('gate_pass_revoked', {'pass_id': pass_id})
    
    def get_active_passes(self, college_id: int, warden_id: int = None):
        """List active gate passes with cache."""
        cache_key = self._get_cache_key('active', f'{college_id}:{warden_id}')
        
        def query():
            qs = GatePass.objects.filter(
                college_id=college_id,
                status='approved',
                valid_until__gt=timezone.now()
            )
            if warden_id:
                qs = qs.filter(warden_id=warden_id)
            return list(qs.values('id', 'student_id', 'valid_until', 'reason'))
        
        result, source = self._get_or_query(cache_key, query)
        return result
    
    def _broadcast_update(self, event_type: str, data: dict):
        """Broadcast update via WebSocket.
        
        [BP1] WS connection loss → queues in Redis for later delivery
        """
        try:
            from channels.layers import get_channel_layer
            import asyncio
            
            channel_layer = get_channel_layer()
            # This would be called from async context in consumers
            # For now, just log
            import logging
            logging.info(f"Would broadcast {event_type}: {data}")
        except Exception as e:
            # If WS fails, operation still completes (fire-and-forget)
            import logging
            logging.warning(f"Failed to broadcast {event_type}: {e}")
```

---

### Meals Service (Analytics-Heavy)

**File**: `backend_django/apps/meals/services.py`

```python
from core.service_resilience import ReadOnlyServiceMixin, with_resilience
from .models import Meal, MealBooking


class MealService(ReadOnlyServiceMixin):
    """Track meal bookings with heavy caching."""
    
    CACHE_TTL = 7200  # 2 hours (daily menus change less frequently)
    
    def get_menu(self, college_id: int, date: date = None):
        """Get meal menu with strong cache.
        
        [BP2] Pool exhaustion → serves cached menu
        [BP3] Redis down → direct DB query takes <100ms
        """
        date = date or timezone.now().date()
        cache_key = self._get_cache_key('menu', f'{college_id}:{date}')
        
        def query():
            return list(
                Meal.objects.filter(
                    college_id=college_id,
                    date=date
                ).values('id', 'meal_type', 'items', 'calories')
            )
        
        result, source = self._get_or_query(cache_key, query, ttl=self.CACHE_TTL)
        print(f"Menu loaded from {source}")
        return result
    
    @with_resilience(max_retries=3, use_cache=True)
    def book_meal(self, user_id: int, college_id: int, meal_id: int):
        """Book a meal with caching."""
        # Cache the result
        booking = self.create_with_resilience(
            MealBooking,
            invalidate_patterns=['user_bookings', 'meal_bookings'],
            student_id=user_id,
            college_id=college_id,
            meal_id=meal_id,
            booked_at=timezone.now()
        )
        return booking
    
    def get_bookings(self, user_id: int, college_id: int, date_from: date = None, date_to: date = None):
        """Get user's meal bookings with cache. 
        
        [BP2] Pool exhaustion during peak hours → cache fallback
        """
        date_from = date_from or timezone.now().date() - timedelta(days=7)
        date_to = date_to or timezone.now().date()
        
        cache_key = self._get_cache_key(
            'bookings',
            f'{user_id}:{college_id}:{date_from}:{date_to}'
        )
        
        def query():
            return list(
                MealBooking.objects.filter(
                    student_id=user_id,
                    college_id=college_id,
                    booked_at__date__gte=date_from,
                    booked_at__date__lte=date_to
                ).values('meal_id', 'booked_at', 'meal__meal_type')
            )
        
        result, source = self._get_or_query(cache_key, query)
        return result
    
    def get_analytics(self, college_id: int):
        """Get meal analytics with very long cache.
        
        Analytics change slowly, benefit from aggressive caching
        """
        cache_key = self._get_cache_key('analytics', college_id)
        
        def query():
            from django.db.models import Count
            
            booking_stats = MealBooking.objects.filter(
                college_id=college_id
            ).values('meal__meal_type').annotate(bookings=Count('id'))
            
            return {
                'total_bookings': MealBooking.objects.filter(college_id=college_id).count(),
                'by_meal_type': list(booking_stats),
            }
        
        result, source = self._get_or_query(
            cache_key,
            query,
            ttl=86400  # Cache for 24 hours (analytics)
        )
        return result
```

---

## Usage Pattern Summary

```python
# 1. Read with cache fallback on connection exhaustion
def get_something(self, identifier):
    return self.get_with_cache(
        identifier,
        query_func=lambda id: Model.objects.get(id=id),
        prefix='get_something'
    )

# 2. List with cache
def list_things(self, **filters):
    return self.list_with_cache(
        query_func=lambda **f: Model.objects.filter(**f),
        prefix='list_things'
    )

# 3. Create with retry + cache invalidation
@with_resilience(max_retries=3)
def create_thing(self, **kwargs):
    return self.create_with_resilience(
        Model,
        invalidate_patterns=['list_things', 'get_something'],
        **kwargs
    )

# 4. Update with retry + cache invalidation
@with_resilience(max_retries=3)
def update_thing(self, obj, **kwargs):
    return self.update_with_resilience(
        obj,
        invalidate_patterns=['list_things', 'get_something'],
        **kwargs
    )

# 5. Batch operations with transaction protection
def bulk_operation(self, items):
    with SafeDatabase() as db:
        for item in items:
            # Each operation auto-retries
            self.create_thing(**item)
```

---

## Testing Resilience Mixins

```python
# tests/test_resilience.py

from django.test import TestCase
from unittest.mock import patch, MagicMock
from apps.attendance.services import AttendanceService
from django.db import IntegrityError


class TestAttendanceServiceResilience(TestCase):
    
    def setUp(self):
        self.service = AttendanceService()
    
    def test_mark_attendance_retries_on_lock(self):
        """Test that transaction lock triggers retry."""
        with patch('apps.attendance.models.Attendance.objects.create') as mock_create:
            # First call fails with lock, second succeeds
            mock_create.side_effect = [
                IntegrityError("Lock timeout"),
                MagicMock(id=1),
            ]
            
            result = self.service.mark_attendance(1, 1)
            assert result.id == 1
            assert mock_create.call_count == 2  # Retried once
    
    def test_get_attendance_uses_cache_on_pool_exhaustion(self):
        """Test fallback to cache when connection pool exhausted."""
        with patch('django.core.cache.cache.get') as mock_cache_get:
            mock_cache_get.return_value = {'student_id': 1, 'status': 'present'}
            
            with patch('apps.attendance.models.Attendance.objects.filter') as mock_filter:
                mock_filter.side_effect = Exception("Connection pool exhausted")
                
                result = self.service.get_user_attendance(1, 1)
                assert result['student_id'] == 1  # Got from cache
    
    def test_bulk_mark_handles_partial_failures(self):
        """Test that bulk operations continue even if some fail."""
        attendances = [
            {'user_id': 1, 'college_id': 1},
            {'user_id': 2, 'college_id': 1},
            {'user_id': 3, 'college_id': 1},
        ]
        
        result = self.service.bulk_mark_attendance(attendances)
        
        # Some may fail, but operation completes
        assert result['created'] + result['failed'] == 3
```

---

## Debugging Tips

### Check if cache is being used
```python
from core.service_resilience import ReadOnlyServiceMixin

service = MyService()
result, source = service._get_or_query(
    'my_cache_key',
    lambda: MyModel.objects.all()
)
print(f"Data came from: {source}")  # 'cache', 'database', or 'degraded_cache'
```

### Monitor retry attempts
```python
import logging
logging.getLogger('django').setLevel(logging.DEBUG)
# Now you'll see retry log messages
```

### Test pool exhaustion locally
```bash
# In Django shell
from django.db import connections
for i in range(11):  # Exhaust max 10 connections
    conn = connections['default']
    conn.ensure_connection()
    print(f"Connection {i+1} acquired")
```

---

## Performance Expectations

| Operation | Without Resilience | With Resilience | Notes |
|-----------|-------------------|-----------------|-------|
| Cache HIT | 5ms | 5ms | No overhead |
| DB Query | 15ms | 15-50ms | Retry adds latency |
| Lock Retry | FAIL | 300-500ms | 3 attempts × exponential backoff |
| Pool Exhausted | FAIL | 5ms (cache) | Fallback to degraded data |
| Redis Down | FAIL | 15ms (DB) | Falls back to direct DB |

---

This integration guide covers all major service patterns. Apply the same patterns to other services in your codebase!
