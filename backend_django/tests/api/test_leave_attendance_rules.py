from __future__ import annotations

from datetime import date

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.attendance.models import Attendance
from apps.gate_passes.models import GatePass
from apps.leaves.models import LeaveApplication


@pytest.mark.django_db(transaction=True)
@pytest.mark.api
class TestLeaveAndAttendanceRules:
    def test_leave_approval_auto_links_gate_pass(
        self,
        api_client: APIClient,
        user_factory,
    ):
        from apps.colleges.models import College

        college = College.objects.create(name="Leave College", code="LEAVE1", is_active=True)
        student = user_factory(
            username="LEAVE_STUDENT",
            registration_number="LEAVE_STUDENT",
            password="LeavePass123",
            role="student",
            student_type="hosteller",
            college=college,
            is_password_changed=True,
        )
        approver = user_factory(
            username="LEAVE_ADMIN",
            registration_number="LEAVE_ADMIN",
            password="LeavePass123",
            role="admin",
            college=college,
            is_password_changed=True,
        )

        leave = LeaveApplication.objects.create(
            college=college,
            student=student,
            leave_type='personal',
            start_date=date.today(),
            end_date=date.today(),
            reason='Family visit',
            destination='Home',
            status='PENDING_APPROVAL',
        )

        api_client.force_authenticate(user=approver)
        response = api_client.post(f"/api/leaves/{leave.id}/approve/", data={"notes": "approved"}, format='json')

        assert response.status_code == 200
        leave.refresh_from_db()
        assert leave.status == 'APPROVED'

        gate_pass = GatePass.objects.filter(leave_application=leave).first()
        assert gate_pass is not None
        assert gate_pass.pass_type == 'leave'
        assert gate_pass.status == 'approved'
        assert gate_pass.student_id == student.id

    def test_mark_attendance_blocks_deallocated_student_without_gate_pass(
        self,
        api_client: APIClient,
        user_factory,
    ):
        admin = user_factory(
            username="ATTN_ADMIN_1",
            registration_number="ATTN_ADMIN_1",
            password="AttendancePass123",
            role="admin",
            is_password_changed=True,
        )
        student = user_factory(
            username="ATTN_DEALLOC_1",
            registration_number="ATTN_DEALLOC_1",
            password="AttendancePass123",
            role="student",
            student_type='hosteller',
            is_password_changed=True,
        )

        api_client.force_authenticate(user=admin)
        response = api_client.post(
            "/api/attendance/mark/",
            data={
                "student_id": student.id,
                "status": "present",
                "date": date.today().isoformat(),
            },
            format='json',
        )

        assert response.status_code == 400
        payload = response.json()
        assert payload.get('code') == 'STUDENT_DEALLOCATED'

    def test_mark_attendance_sets_out_gatepass_for_deallocated_student_with_active_gate_pass(
        self,
        api_client: APIClient,
        user_factory,
        gate_pass_factory,
    ):
        admin = user_factory(
            username="ATTN_ADMIN_2",
            registration_number="ATTN_ADMIN_2",
            password="AttendancePass123",
            role="admin",
            is_password_changed=True,
        )
        student = user_factory(
            username="ATTN_DEALLOC_2",
            registration_number="ATTN_DEALLOC_2",
            password="AttendancePass123",
            role="student",
            student_type='hosteller',
            is_password_changed=True,
        )

        gate_pass = gate_pass_factory(
            student=student,
            exit_date=timezone.now() - timezone.timedelta(hours=1),
            entry_date=timezone.now() + timezone.timedelta(hours=2),
        )
        GatePass.objects.filter(id=gate_pass.id).update(status='out')

        api_client.force_authenticate(user=admin)
        response = api_client.post(
            "/api/attendance/mark/",
            data={
                "student_id": student.id,
                "status": "absent",
                "date": date.today().isoformat(),
            },
            format='json',
        )

        assert response.status_code == 200
        payload = response.json()
        assert payload.get('code') == 'STUDENT_OUT_DEALLOCATED'
        assert payload.get('status') == 'out_gatepass'

        record = Attendance.objects.get(user_id=student.id, attendance_date=date.today())
        assert record.status == 'out_gatepass'

    def test_mark_all_excludes_deallocated_students(
        self,
        api_client: APIClient,
        user_factory,
        building_factory,
        room_factory,
        allocation_factory,
    ):
        admin = user_factory(
            username="ATTN_ADMIN_3",
            registration_number="ATTN_ADMIN_3",
            password="AttendancePass123",
            role="admin",
            is_password_changed=True,
        )
        active_student = user_factory(
            username="ATTN_ACTIVE_1",
            registration_number="ATTN_ACTIVE_1",
            password="AttendancePass123",
            role="student",
            student_type='hosteller',
            is_password_changed=True,
        )
        deallocated_student = user_factory(
            username="ATTN_DEALLOC_3",
            registration_number="ATTN_DEALLOC_3",
            password="AttendancePass123",
            role="student",
            student_type='hosteller',
            is_password_changed=True,
        )

        building = building_factory(name="Attendance Block", code="ATTB1")
        room = room_factory(building=building, room_number="AT-101")
        allocation_factory(student=active_student, room=room)

        api_client.force_authenticate(user=admin)
        response = api_client.post(
            "/api/attendance/mark-all/",
            data={"status": "absent", "date": date.today().isoformat()},
            format='json',
        )

        assert response.status_code == 200
        assert Attendance.objects.filter(user_id=active_student.id, attendance_date=date.today()).exists()
        assert not Attendance.objects.filter(user_id=deallocated_student.id, attendance_date=date.today()).exists()

    def test_sync_missing_records_skips_deallocated_students_without_gate_pass(
        self,
        api_client: APIClient,
        user_factory,
        building_factory,
        room_factory,
        allocation_factory,
    ):
        admin = user_factory(
            username="ATTN_ADMIN_4",
            registration_number="ATTN_ADMIN_4",
            password="AttendancePass123",
            role="admin",
            is_password_changed=True,
        )
        active_student = user_factory(
            username="SYNC_ACTIVE_1",
            registration_number="SYNC_ACTIVE_1",
            password="AttendancePass123",
            role="student",
            student_type='hosteller',
            is_password_changed=True,
        )
        deallocated_student = user_factory(
            username="SYNC_DEALLOC_1",
            registration_number="SYNC_DEALLOC_1",
            password="AttendancePass123",
            role="student",
            student_type='hosteller',
            is_password_changed=True,
        )

        building = building_factory(name="Sync Block", code="SYNCB1")
        room = room_factory(building=building, room_number="SY-101")
        allocation_factory(student=active_student, room=room)

        api_client.force_authenticate(user=admin)
        response = api_client.post(
            "/api/attendance/sync_missing_records/",
            data={"date": date.today().isoformat()},
            format='json',
        )

        assert response.status_code == 200
        payload = response.json()
        assert 'Skipped 1 deallocated students' in payload.get('detail', '')

        assert Attendance.objects.filter(user_id=active_student.id, attendance_date=date.today()).exists()
        assert not Attendance.objects.filter(user_id=deallocated_student.id, attendance_date=date.today()).exists()
