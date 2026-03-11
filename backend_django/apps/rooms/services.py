import logging
from django.db import transaction, DatabaseError, OperationalError
from datetime import date
from django.utils import timezone
from apps.rooms.models import Room, RoomAllocation, Bed, RoomAllocationHistory

logger = logging.getLogger(__name__)


def auto_allocate_student(student, allocated_by=None):
    """
    Automatically allocates an unassigned student to the first available room
    that matches their college, or any available room if no college matching is needed.

    Uses savepoints so that a failed allocation attempt on one room does NOT
    corrupt the outer transaction (e.g. the post_save signal's atomic block).
    """
    if RoomAllocation.objects.filter(student=student, end_date__isnull=True).exists():
        return False, "Student is already allocated."

    from django.db import models as djmodels
    rooms_qs = Room.objects.filter(
        is_available=True,
        current_occupancy__lt=djmodels.F('capacity')
    ).order_by('building__id', 'floor', 'room_number')

    if getattr(student, 'college_id', None):
        # Prioritize rooms in the student's college's hostels
        rooms_qs = list(
            rooms_qs.filter(building__hostel__college_id=student.college_id)
        ) + list(
            rooms_qs.exclude(building__hostel__college_id=student.college_id)
        )
    else:
        rooms_qs = list(rooms_qs)

    for room in rooms_qs:
        try:
            # Use a savepoint (nested atomic) so that any failure here only
            # rolls back to this savepoint, NOT the outer post_save transaction.
            with transaction.atomic():
                # Lock the room row to prevent race conditions (use select_for_update
                # WITHOUT nowait so we queue instead of raising immediately).
                # nowait=True raises OperationalError on SQLite and DatabaseError on PG
                # which previously poisoned the outer transaction.
                try:
                    current_room = Room.objects.select_for_update().get(id=room.id)
                except OperationalError:
                    # SQLite doesn't support select_for_update — fall back to plain get
                    current_room = Room.objects.get(id=room.id)

                if current_room.current_occupancy >= current_room.capacity:
                    continue

                bed = current_room.beds.filter(is_occupied=False).first()

                if not bed:
                    bed = Bed.objects.create(
                        room=current_room,
                        bed_number=f'{current_room.room_number}-X{current_room.current_occupancy + 1}'
                    )

                # FIX: correct field name is 'allocated_by', not 'changed_by'
                allocation = RoomAllocation.objects.create(
                    room=current_room,
                    bed=bed,
                    student=student,
                    status='approved',
                    allocated_date=date.today(),
                    allocated_by=allocated_by or student,
                )

                bed.is_occupied = True
                bed.save(update_fields=['is_occupied'])

                current_room.current_occupancy += 1
                current_room.save(update_fields=['current_occupancy'])

                RoomAllocationHistory.objects.create(
                    student=student,
                    action='allocated',
                    to_room=current_room,
                    to_bed=bed,
                    changed_by=allocated_by or student,
                    details="Auto-allocated"
                )

                # Async-safe WebSocket broadcast (never raises)
                try:
                    from websockets.broadcast import notify_room_allocated
                    notify_room_allocated(current_room, student)
                except Exception as ws_err:
                    logger.warning(f"AUTO_ALLOCATION: WebSocket notify failed (non-fatal): {ws_err}")

                try:
                    from apps.rooms.views import invalidate_hostel_map_cache
                    invalidate_hostel_map_cache()
                except Exception:
                    pass

                logger.info(
                    f"AUTO_ALLOCATION: Student ID {student.id} | Room {current_room.room_number} "
                    f"| Bed {bed.bed_number} | {timezone.now()}"
                )
                return True, current_room

        except (DatabaseError, OperationalError) as e:
            # Savepoint rolled back cleanly — log and try the next room
            logger.debug(f"AUTO_ALLOCATION: Room {room.id} skipped ({type(e).__name__}: {e})")
            continue

    return False, "No rooms available."
