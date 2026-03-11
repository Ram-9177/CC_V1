import logging
from django.db import transaction, DatabaseError
from datetime import date
from django.utils import timezone
from apps.rooms.models import Room, RoomAllocation, Bed, RoomAllocationHistory
from apps.auth.models import User
from websockets.broadcast import notify_room_allocated

logger = logging.getLogger(__name__)

def auto_allocate_student(student, changed_by=None):
    """
    Automatically allocates an unassigned student to the first available room 
    that matches their college, or any available room if no college matching is needed.
    """
    if RoomAllocation.objects.filter(student=student, end_date__isnull=True).exists():
        return False, "Student is already allocated."

    # 1. Identify selected hostel or block based on student's college
    # We fetch rooms that are active and have capacity.
    from django.db import models
    rooms_qs = Room.objects.filter(
        is_available=True, 
        current_occupancy__lt=models.F('capacity')
    ).order_by('building__id', 'floor', 'room_number')

    if getattr(student, 'college_id', None):
        # Prioritize rooms in the student's college's hostels
        rooms_qs = list(rooms_qs.filter(building__hostel__college_id=student.college_id)) + list(rooms_qs.exclude(building__hostel__college_id=student.college_id))
    else:
        rooms_qs = list(rooms_qs)
        
    for room in rooms_qs:
        try:
            with transaction.atomic():
                # 3. Check current occupancy and room capacity (prevent over-allocation)
                current_room = Room.objects.select_for_update(nowait=True).get(id=room.id)
                
                if current_room.current_occupancy < current_room.capacity:
                    bed = current_room.beds.filter(is_occupied=False).first()
                    
                    if not bed:
                        bed = Bed.objects.create(
                            room=current_room, 
                            bed_number=f'{current_room.room_number}-X{current_room.current_occupancy + 1}'
                        )
                    
                    # 4. Assign student
                    allocation = RoomAllocation.objects.create(
                        room=current_room,
                        bed=bed,
                        student=student,
                        status='approved',
                        allocated_date=date.today(),
                        changed_by=changed_by or student
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
                        changed_by=changed_by or student,
                        details="Auto-allocated"
                    )
                    
                    # Notify websockets
                    notify_room_allocated(current_room, student)

                    from apps.rooms.views import invalidate_hostel_map_cache
                    invalidate_hostel_map_cache()

                    # Logging requirements
                    logger.info(f"AUTO_ALLOCATION: Student ID {student.id} | Room Assigned: {current_room.room_number} | Timestamp: {timezone.now()}")
                    
                    return True, current_room
        except DatabaseError:
            continue
            
    return False, "No rooms available."
