import os
import django
import sys

# Ensure the backend_django directory is in the PYTHONPATH
sys.path.append('/Users/ram/Desktop/SMG-Hostel/backend_django')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.auth.models import User
from apps.rooms.models import Room, RoomAllocation, Bed
from django.db import transaction
from datetime import date

with transaction.atomic():
    students = User.objects.filter(role='student')
    unallocated_students = []
    
    for s in students:
        if not RoomAllocation.objects.filter(student=s, end_date__isnull=True).exists():
           unallocated_students.append(s)
           
    rooms = Room.objects.all().order_by('building__id', 'floor', 'room_number')
    print(f'Found {len(unallocated_students)} unallocated students and {rooms.count()} rooms.')
    
    allocated_count = 0
    assigned_status = []
    
    for student in unallocated_students:
        allocated = False
        for room in rooms:
           # Re-fetch room inside loop to get updated DB values
           current_room = Room.objects.get(id=room.id)
           
           if current_room.current_occupancy < current_room.capacity:
               bed = Bed.objects.filter(room=current_room, is_occupied=False).first()
               if not bed:
                   # Try to create fallback bed if missing
                   bed = Bed.objects.create(room=current_room, bed_number=f'{current_room.room_number}-Extra')
               
               RoomAllocation.objects.create(
                   room=current_room,
                   bed=bed,
                   student=student,
                   status='approved',
                   allocated_date=date.today()
               )
               
               bed.is_occupied = True
               bed.save()
               
               current_room.current_occupancy += 1
               current_room.save()
               
               allocated_count += 1
               assigned_status.append(f'Allocated {student.registration_number or student.username} to Room {current_room.room_number}')
               allocated = True
               break
               
        if not allocated:
             print(f'Warning: Out of capacity! Could not allocate {student.registration_number or student.username}')
             
    print('\n'.join(assigned_status))
    print(f'\nSuccessfully allocated {allocated_count} students.')
