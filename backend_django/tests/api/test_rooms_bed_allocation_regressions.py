from __future__ import annotations

from datetime import date

import pytest

from apps.colleges.models import College
from apps.rooms.models import Bed, Building, Hostel, RoomAllocation


@pytest.mark.django_db
def test_allocate_rejects_non_student_user(api_client, user_factory, room_factory, bed_factory):
    super_admin = user_factory(username='ALLOC_SUPER_1', role='super_admin')
    staff_user = user_factory(username='ALLOC_STAFF_1', role='staff')
    room = room_factory(room_number='RS-101')
    bed = bed_factory(room=room, bed_number='RS-101-1')

    api_client.force_authenticate(user=super_admin)
    response = api_client.post(
        f'/api/rooms/{room.id}/allocate/',
        {'user_id': staff_user.id, 'bed_id': bed.id},
        format='json',
    )

    assert response.status_code == 400
    assert 'Only student users can be allocated to rooms.' in response.json().get('detail', '')


@pytest.mark.django_db
def test_delete_bed_rejects_occupied_bed(api_client, user_factory, room_factory, bed_factory):
    super_admin = user_factory(username='BEDDEL_SUPER_1', role='super_admin')
    student = user_factory(username='BEDDEL_STUDENT_1', role='student')
    room = room_factory(room_number='RB-101')
    bed = bed_factory(room=room, bed_number='RB-101-1', is_occupied=True)

    RoomAllocation.objects.create(
        student=student,
        room=room,
        bed=bed,
        status='approved',
        allocated_date=date.today(),
        end_date=None,
    )

    api_client.force_authenticate(user=super_admin)
    response = api_client.delete(f'/api/rooms/beds/{bed.id}/')

    assert response.status_code == 400
    payload = response.json()
    assert payload.get('success') is False
    assert 'occupied bed' in payload.get('message', '').lower()
    assert Bed.objects.filter(id=bed.id).exists()


@pytest.mark.django_db
def test_allocate_requires_warden_room_scope(api_client, user_factory, room_factory, bed_factory):
    college = College.objects.create(
        name='Scope Test College',
        code='SCOPETEST',
        city='Scope City',
        state='Scope State',
    )
    hostel = Hostel.objects.create(name='Scope Hostel', college=college)
    building = Building.objects.create(
        name='Scope Block',
        code='SCOPE-B1',
        total_floors=3,
        college=college,
        hostel=hostel,
    )

    warden = user_factory(username='SCOPE_WARDEN_1', role='warden', college=college)
    student = user_factory(username='SCOPE_STUDENT_1', role='student', college=college)

    room = room_factory(room_number='SC-101', building=building, college=college)
    bed = bed_factory(room=room, bed_number='SC-101-1')

    # The warden has no assigned blocks, so they must not allocate this room.
    api_client.force_authenticate(user=warden)
    response = api_client.post(
        f'/api/rooms/{room.id}/allocate/',
        {'user_id': student.id, 'bed_id': bed.id},
        format='json',
    )

    assert response.status_code == 404
    assert 'no authority' in response.json().get('detail', '').lower()
    assert not RoomAllocation.objects.filter(student=student, end_date__isnull=True).exists()
