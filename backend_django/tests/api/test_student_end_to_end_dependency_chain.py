from __future__ import annotations

from datetime import date, timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.attendance.models import Attendance
from apps.gate_passes.models import GatePass
from apps.leaves.models import LeaveApplication


@pytest.mark.django_db
@pytest.mark.api
class TestStudentEndToEndDependencyChain:
    def test_student_gatepass_flow_propagates_to_warden_scope(
        self,
        api_client: APIClient,
        user_factory,
        building_factory,
        room_factory,
        allocation_factory,
    ):
        from apps.colleges.models import College

        college_a = College.objects.create(name='Stu Chain A', code='SCA11', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Stu Chain B', code='SCB11', city='City', state='State', is_active=True)
        student = user_factory(username='CHAIN_STUDENT_1', role='student', college=college_a, student_type='hosteller')
        warden_a = user_factory(username='CHAIN_WARDEN_A', role='warden', college=college_a)
        warden_b = user_factory(username='CHAIN_WARDEN_B', role='warden', college=college_b)

        building = building_factory(name='Chain Block', code='CBLK1', college=college_a)
        room = room_factory(building=building, room_number='CB-101', college=college_a, created_by=warden_a)
        allocation_factory(student=student, room=room, college=college_a)
        warden_a.assigned_blocks.add(building)

        api_client.force_authenticate(user=student)
        create_response = api_client.post(
            '/api/gate-passes/',
            {
                'pass_type': 'day',
                'reason': 'Medical visit',
                'destination': 'City Hospital',
                'exit_date': (date.today() + timedelta(days=1)).isoformat(),
                'exit_time': '10:00',
                'expected_return_date': (date.today() + timedelta(days=1)).isoformat(),
                'expected_return_time': '18:00',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        assert create_response.status_code == 201
        gate_pass_id = create_response.json()['id']

        student_list = api_client.get('/api/gate-passes/', HTTP_HOST='localhost')
        assert student_list.status_code == 200
        student_ids = {row.get('id') for row in student_list.json().get('results', [])}
        assert gate_pass_id in student_ids

        api_client.force_authenticate(user=warden_a)
        warden_a_list = api_client.get('/api/gate-passes/', HTTP_HOST='localhost')
        assert warden_a_list.status_code == 200
        warden_a_ids = {row.get('id') for row in warden_a_list.json().get('results', [])}
        assert gate_pass_id in warden_a_ids

        api_client.force_authenticate(user=warden_b)
        warden_b_list = api_client.get('/api/gate-passes/', HTTP_HOST='localhost')
        assert warden_b_list.status_code == 200
        warden_b_ids = {row.get('id') for row in warden_b_list.json().get('results', [])}
        assert gate_pass_id not in warden_b_ids

    def test_student_leave_approval_propagates_active_leave_and_gate_pass(
        self,
        api_client: APIClient,
        user_factory,
    ):
        from apps.colleges.models import College

        college = College.objects.create(name='Leave Chain College', code='LCC11', city='City', state='State', is_active=True)
        student = user_factory(username='CHAIN_LEAVE_STU', role='student', student_type='hosteller', college=college)
        admin = user_factory(username='CHAIN_LEAVE_ADMIN', role='admin', college=college)

        api_client.force_authenticate(user=student)
        create_leave = api_client.post(
            '/api/leaves/',
            {
                'leave_type': 'personal',
                'start_date': date.today().isoformat(),
                'end_date': date.today().isoformat(),
                'reason': 'Family emergency',
                'destination': 'Home',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        assert create_leave.status_code == 201
        leave_id = create_leave.json()['id']

        api_client.force_authenticate(user=admin)
        approve = api_client.post(f'/api/leaves/{leave_id}/approve/', {'notes': 'approved'}, format='json', HTTP_HOST='localhost')
        assert approve.status_code == 200
        LeaveApplication.objects.get(id=leave_id, status='APPROVED')

        api_client.force_authenticate(user=student)
        active_leaves = api_client.get('/api/leaves/my_active/', HTTP_HOST='localhost')
        assert active_leaves.status_code == 200
        assert any(row.get('id') == leave_id for row in active_leaves.json())

        linked_pass = GatePass.objects.filter(leave_application_id=leave_id).first()
        assert linked_pass is not None
        assert linked_pass.status in {'approved', 'out', 'outside', 'used', 'in', 'returned', 'completed'}

    def test_student_complaint_visible_to_same_college_admin_only(
        self,
        api_client: APIClient,
        user_factory,
    ):
        from apps.colleges.models import College

        college_a = College.objects.create(name='Complaint Chain A', code='CCA11', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Complaint Chain B', code='CCB11', city='City', state='State', is_active=True)
        student = user_factory(username='CHAIN_COMP_STU', role='student', student_type='hosteller', college=college_a)
        admin_a = user_factory(username='CHAIN_COMP_ADMIN_A', role='admin', college=college_a)
        admin_b = user_factory(username='CHAIN_COMP_ADMIN_B', role='admin', college=college_b)

        api_client.force_authenticate(user=student)
        create = api_client.post(
            reverse('complaints:complaint-list'),
            {
                'category': 'electrical',
                'title': 'Chain complaint',
                'description': 'End-to-end propagation check',
                'priority': '2',
            },
            format='json',
            HTTP_HOST='localhost',
        )
        assert create.status_code == 201
        complaint_id = create.json()['id']

        api_client.force_authenticate(user=admin_a)
        list_a = api_client.get(reverse('complaints:complaint-list'), HTTP_HOST='localhost')
        assert list_a.status_code == 200
        ids_a = {row.get('id') for row in list_a.json().get('results', [])}
        assert complaint_id in ids_a

        api_client.force_authenticate(user=admin_b)
        list_b = api_client.get(reverse('complaints:complaint-list'), HTTP_HOST='localhost')
        assert list_b.status_code == 200
        ids_b = {row.get('id') for row in list_b.json().get('results', [])}
        assert complaint_id not in ids_b

    def test_student_search_does_not_expose_peer_students(
        self,
        api_client: APIClient,
        user_factory,
    ):
        from apps.colleges.models import College

        college = College.objects.create(name='Search Chain College', code='SCC11', city='City', state='State', is_active=True)
        student_a = user_factory(username='CHAIN_SEARCH_A', role='student', student_type='hosteller', college=college)
        student_b = user_factory(username='CHAIN_SEARCH_B', role='student', student_type='hosteller', college=college)

        api_client.force_authenticate(user=student_a)
        response = api_client.get(f'/api/search/global/?q={student_b.username}', HTTP_HOST='localhost')
        assert response.status_code == 200
        payload = response.json().get('results', [])
        user_hits = [row for row in payload if row.get('category') == 'Users']
        assert all(str(row.get('id')) != str(student_b.id) for row in user_hits)

    def test_student_gatepass_out_status_propagates_to_security_live_out_list_with_scope(
        self,
        api_client: APIClient,
        user_factory,
    ):
        from apps.colleges.models import College

        college_a = College.objects.create(name='Live Out A', code='LOA11', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Live Out B', code='LOB11', city='City', state='State', is_active=True)
        student = user_factory(username='CHAIN_LIVE_STU', role='student', student_type='hosteller', college=college_a)
        security_a = user_factory(username='CHAIN_SEC_A', role='gate_security', college=college_a)
        security_b = user_factory(username='CHAIN_SEC_B', role='gate_security', college=college_b)

        gate_pass = GatePass.objects.create(
            student=student,
            college=college_a,
            pass_type='day',
            status='out',
            reason='Medical',
            destination='Clinic',
            exit_date=timezone.now(),
        )

        api_client.force_authenticate(user=security_a)
        list_a = api_client.get('/api/gate-passes/live_out_list/', HTTP_HOST='localhost')
        assert list_a.status_code == 200
        ids_a = {row.get('id') for row in list_a.json()}
        assert str(gate_pass.id) in ids_a

        api_client.force_authenticate(user=security_b)
        list_b = api_client.get('/api/gate-passes/live_out_list/', HTTP_HOST='localhost')
        assert list_b.status_code == 200
        ids_b = {row.get('id') for row in list_b.json()}
        assert str(gate_pass.id) not in ids_b

    def test_student_gatepass_out_state_propagates_to_attendance_out_gatepass_status(
        self,
        api_client: APIClient,
        user_factory,
    ):
        from apps.colleges.models import College

        college = College.objects.create(name='Attendance Chain', code='ATC11', city='City', state='State', is_active=True)
        student = user_factory(username='CHAIN_ATTN_STU', role='student', student_type='hosteller', college=college)
        admin = user_factory(username='CHAIN_ATTN_ADMIN', role='admin', college=college)

        GatePass.objects.create(
            student=student,
            college=college,
            pass_type='day',
            status='out',
            reason='Family visit',
            destination='Home',
            exit_date=timezone.now(),
        )

        api_client.force_authenticate(user=admin)
        mark = api_client.post(
            '/api/attendance/mark/',
            {
                'student_id': student.id,
                'status': 'absent',
                'date': date.today().isoformat(),
            },
            format='json',
            HTTP_HOST='localhost',
        )
        assert mark.status_code == 200
        payload = mark.json()
        assert payload.get('status') == 'out_gatepass'
        assert payload.get('code') == 'STUDENT_OUT_DEALLOCATED'

        attendance = Attendance.objects.get(user_id=student.id, attendance_date=date.today())
        assert attendance.status == 'out_gatepass'

