"""Institutional Seed Script for SMG College Rooms & Beds."""
import os
import django
import sys

# Setup Django Context
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from apps.colleges.models import College
from apps.rooms.models import Hostel, Building, Room, Bed, RoomAllocation
from apps.auth.models import User
from django.utils import timezone
from datetime import date

def seed_smg_infrastructure():
    print("🌱 Seeding SMG Infrastructure...")
    
    try:
        smg = College.objects.get(code='SMG')
    except College.DoesNotExist:
        print("❌ Error: College 'SMG' not found. Run base seeding first.")
        return

    # 1. Hostel & Building
    hostel, _ = Hostel.objects.get_or_create(name='Main Hostel', college=smg)
    building, _ = Building.objects.get_or_create(
        code='BA1', 
        defaults={'name': 'Block-A', 'hostel': hostel, 'total_floors': 4, 'gender_type': 'boys', 'college': smg}
    )

    # 2. Rooms & Beds (10 rooms across 2 floors)
    created_rooms = 0
    for floor in [1, 2]:
        for room_num in range(1, 6):
            room_id = f"{floor}0{room_num}"
            room, created = Room.objects.get_or_create(
                building=building,
                room_number=room_id,
                defaults={
                    'floor': floor,
                    'room_type': 'triple',
                    'capacity': 3,
                    'status': 'available',
                }
            )
            if created:
                created_rooms += 1
                # Create 3 beds for each room
                for b in range(1, 4):
                    Bed.objects.get_or_create(room=room, bed_number=str(b))
    
    print(f"✅ Created {created_rooms} new triple-occupancy rooms.")

    # 3. Student Allocation
    try:
        student = User.objects.get(username='TEST_STUDENT')
        # Assign to first room, first bed
        target_room = Room.objects.filter(building=building, floor=1).first()
        target_bed = Bed.objects.filter(room=target_room, bed_number='1').first()
        
        if target_bed and not RoomAllocation.objects.filter(student=student, end_date__isnull=True).exists():
            RoomAllocation.objects.create(
                student=student,
                room=target_room,
                bed=target_bed,
                status='approved',
                allocated_date=date.today(),
                college=smg
            )
            target_bed.is_occupied = True
            target_bed.save()
            target_room.current_occupancy += 1
            target_room.save()
            print(f"✅ Allocated TEST_STUDENT to {target_room.room_number} - Bed 1")
    except User.DoesNotExist:
        print("⚠️ Warning: TEST_STUDENT not found, skipping allocation.")

    print("✨ SMG Seeding Complete.")

if __name__ == "__main__":
    seed_smg_infrastructure()
