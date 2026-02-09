
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.auth.models import User
from apps.users.models import Tenant
from apps.rooms.models import Building, Room, Bed, RoomAllocation
from apps.colleges.models import College
from django.utils import timezone
import datetime

class Command(BaseCommand):
    help = 'Seeds mandatory data for comprehensive smoke test.'

    def handle(self, *args, **options):
        with transaction.atomic():
            self.stdout.write('Seeding data...')
            
            # 1. College
            college, _ = College.objects.get_or_create(code='SMRU', defaults={'name': 'SMRU College'})
            
            # 2. Building & Room
            bld, _ = Building.objects.get_or_create(code='BLKA', defaults={'name': 'Block A', 'total_floors': 4})
            room, _ = Room.objects.get_or_create(
                room_number='101', 
                building=bld, 
                defaults={'floor': 1, 'capacity': 2, 'room_type': 'double'}
            )
            bed, _ = Bed.objects.get_or_create(
                room=room, 
                bed_number='101-A'
            )

            # 3. Allocation
            student = User.objects.filter(username='2024TEST001').first()
            if student:
                # Clear existing allocations for clean test
                RoomAllocation.objects.filter(student=student).delete()
                Bed.objects.filter(room=room).update(is_occupied=False)
                
                RoomAllocation.objects.create(
                    student=student,
                    room=room,
                    bed=bed,
                    allocated_date=timezone.now().date(),
                    status='approved'
                )
                bed.is_occupied = True
                bed.save()
                self.stdout.write(f'Allocated {student.username} to Room 101, Bed 101-A')

        self.stdout.write(self.style.SUCCESS('Seeding complete.'))
