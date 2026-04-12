from __future__ import annotations

from datetime import date

import pytest
from django.db import IntegrityError

from apps.rooms.models import RoomAllocation


@pytest.mark.django_db
@pytest.mark.integration
class TestRoomAllocationConstraints:
    def test_single_active_allocation_per_student(self, user_factory, room_factory):
        student = user_factory(username="STU_ALLOC_A", role="student")
        room_one = room_factory(room_number="A-101")
        room_two = room_factory(room_number="A-102")

        RoomAllocation.objects.create(
            student=student,
            room=room_one,
            status="approved",
            allocated_date=date.today(),
            end_date=None,
        )

        with pytest.raises(IntegrityError):
            RoomAllocation.objects.create(
                student=student,
                room=room_two,
                status="approved",
                allocated_date=date.today(),
                end_date=None,
            )

    def test_new_active_allocation_allowed_after_previous_end(self, user_factory, room_factory):
        student = user_factory(username="STU_ALLOC_B", role="student")
        room_one = room_factory(room_number="B-101")
        room_two = room_factory(room_number="B-102")

        first = RoomAllocation.objects.create(
            student=student,
            room=room_one,
            status="approved",
            allocated_date=date.today(),
            end_date=None,
        )

        first.end_date = date.today()
        first.save(update_fields=["end_date"])

        second = RoomAllocation.objects.create(
            student=student,
            room=room_two,
            status="approved",
            allocated_date=date.today(),
            end_date=None,
        )

        assert second.id is not None

    def test_single_active_allocation_per_bed(self, user_factory, room_factory, bed_factory):
        student_one = user_factory(username="STU_ALLOC_C1", role="student")
        student_two = user_factory(username="STU_ALLOC_C2", role="student")
        room = room_factory(room_number="C-101")
        bed = bed_factory(room=room, bed_number="1")

        RoomAllocation.objects.create(
            student=student_one,
            room=room,
            bed=bed,
            status="approved",
            allocated_date=date.today(),
            end_date=None,
        )

        with pytest.raises(IntegrityError):
            RoomAllocation.objects.create(
                student=student_two,
                room=room,
                bed=bed,
                status="approved",
                allocated_date=date.today(),
                end_date=None,
            )
