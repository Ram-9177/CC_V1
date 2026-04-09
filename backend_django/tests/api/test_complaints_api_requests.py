from __future__ import annotations

import pytest
from rest_framework.test import APIClient
from django.urls import reverse
from tests.utils import assert_json_keys

@pytest.mark.django_db(transaction=True)
@pytest.mark.api
class TestComplaintsAPIWithRequests:
    def test_complaint_crud_flow_get_post_put_delete(
        self,
        api_client: APIClient,
        user_factory,
    ):
        from apps.colleges.models import College
        college = College.objects.create(name="Test College", code="TEST", is_active=True)
        
        student = user_factory(
            username="API_COMPLAINT_STUDENT",
            registration_number="API_COMPLAINT_STUDENT",
            password="ComplaintPass123",
            role="student",
            student_type="hosteller",
            college=college,
            is_password_changed=True,
        )
        api_client.force_authenticate(user=student)

        list_url = reverse('complaints:complaint-list')
        list_response = api_client.get(list_url)
        if list_response.status_code == 404:
            with open('/tmp/test_404.log', 'w') as f:
                f.write(f"URL: {list_url}\n")
                f.write(f"Content: {list_response.content.decode()}\n")
        assert list_response.status_code == 200
        
        create_payload = {
            "category": "electrical",
            "title": "Tube light not working",
            "description": "Room light failed at night.",
            "priority": "2",
        }
        create_response = api_client.post(
            list_url,
            data=create_payload,
            format='json'
        )
        assert create_response.status_code == 201
        created = create_response.json()
        assert_json_keys(created, ["id", "category", "title", "description", "priority", "status"])
        complaint_id = created["id"]

        detail_url = reverse('complaints:complaint-detail', kwargs={'pk': complaint_id})
        update_payload = {
            "category": "electrical",
            "title": "Tube light replaced request",
            "description": "Please replace with a new LED.",
            "priority": "1",
            "status": "in_progress",
        }
        put_response = api_client.put(
            detail_url,
            data=update_payload,
            format='json'
        )
        assert put_response.status_code == 200
        updated = put_response.json()
        assert updated["title"] == "Tube light replaced request"
        assert updated["priority"] == "1"
        assert updated["status"] == "in_progress"

        delete_response = api_client.delete(detail_url)
        assert delete_response.status_code == 204

        not_found_response = api_client.get(detail_url)
        assert not_found_response.status_code == 404

    def test_create_complaint_rejects_invalid_payload(
        self,
        api_client: APIClient,
        user_factory,
    ):
        user = user_factory(
            username="API_COMPLAINT_INVALID",
            registration_number="API_COMPLAINT_INVALID",
            password="ComplaintPass123",
            role="student",
            student_type="hosteller",
            is_password_changed=True,
        )
        api_client.force_authenticate(user=user)

        list_url = reverse('complaints:complaint-list')
        invalid_payload = {
            "category": "electrical",
            "description": "Missing title should fail",
            "severity": "medium",
        }

        response = api_client.post(
            list_url,
            data=invalid_payload,
            format='json'
        )

        assert response.status_code == 400
        payload = response.json()
        assert payload.get("code") in {"API_ERROR", "VALIDATION_ERROR"}

    def test_escalation_preserves_in_progress_status_while_reassigning(
        self,
        api_client: APIClient,
        user_factory,
        building_factory,
        room_factory,
        allocation_factory,
    ):
        from apps.colleges.models import College
        from apps.complaints.models import Complaint, ComplaintUpdate

        college = College.objects.create(name="Escalation Normalize College", code="ESCN01", is_active=True)

        student = user_factory(
            username="API_ESCN_STUDENT",
            registration_number="API_ESCN_STUDENT",
            password="ComplaintPass123",
            role="student",
            student_type="hosteller",
            college=college,
            is_password_changed=True,
        )

        building = building_factory(name="Esc Norm Block", code="ENB1")
        room = room_factory(building=building, room_number="EN-101")
        allocation_factory(student=student, room=room)

        warden = user_factory(
            username="API_ESCN_WARDEN",
            registration_number="API_ESCN_WARDEN",
            password="ComplaintPass123",
            role="warden",
            college=college,
            is_password_changed=True,
        )
        warden.assigned_blocks.add(building)

        head_warden = user_factory(
            username="API_ESCN_HEAD",
            registration_number="API_ESCN_HEAD",
            password="ComplaintPass123",
            role="head_warden",
            college=college,
            is_password_changed=True,
        )

        api_client.force_authenticate(user=student)
        create_response = api_client.post(
            reverse('complaints:complaint-list'),
            data={
                "category": "electrical",
                "title": "Normalize escalation status",
                "description": "Escalation should not reset in-progress work",
                "priority": "1",
            },
            format='json',
        )
        assert create_response.status_code == 201
        complaint_id = create_response.json()["id"]

        complaint = Complaint.objects.get(id=complaint_id)
        complaint.status = 'in_progress'
        complaint.save(update_fields=['status', 'updated_at'])

        api_client.force_authenticate(user=warden)
        escalate_response = api_client.post(
            reverse('complaints:complaint-escalate', kwargs={'pk': complaint_id}),
            data={'comment': 'Needs higher authority due vendor dependency.'},
            format='json',
        )

        assert escalate_response.status_code == 200
        complaint.refresh_from_db()
        assert complaint.assigned_to_id == head_warden.id
        assert complaint.escalation_level == 2
        assert complaint.status == 'in_progress'

        assert ComplaintUpdate.objects.filter(
            complaint_id=complaint.id,
            status_from='in_progress',
            status_to='in_progress',
        ).exists()

    def test_create_complaint_without_auth_returns_401(self, api_client: APIClient):
        list_url = reverse('complaints:complaint-list')
        response = api_client.post(
            list_url,
            data={
                "category": "internet",
                "title": "No internet",
                "description": "Wi-Fi down",
                "severity": "high",
            },
            format='json'
        )

        assert response.status_code == 401

    def test_day_scholar_student_restricted_from_creating_complaints(
        self,
        api_client: APIClient,
        user_factory,
    ):
        # Create a day scholar student (blocked in current phase)
        student = user_factory(
            username="STRICT_STUDENT",
            registration_number="STRICT_STUDENT",
            password="StudentPass123",
            role="student",
            student_type="day_scholar",
            is_password_changed=True,
        )
        api_client.force_authenticate(user=student)

        list_url = reverse('complaints:complaint-list')
        # Try to create a complaint
        response = api_client.post(
            list_url,
            data={
                "category": "plumbing",
                "title": "Tap leaking",
                "description": "Tap in washroom is leaking.",
            },
            format='json'
        )

        assert response.status_code == 400
        assert "day scholar" in str(response.json()).lower()

    def test_non_student_restricted_from_creating_complaints(
        self,
        api_client: APIClient,
        user_factory,
    ):
        staff_user = user_factory(
            username="API_COMPLAINT_STAFF",
            registration_number="API_COMPLAINT_STAFF",
            password="ComplaintPass123",
            role="warden",
            is_password_changed=True,
        )
        api_client.force_authenticate(user=staff_user)

        list_url = reverse('complaints:complaint-list')
        response = api_client.post(
            list_url,
            data={
                "category": "electrical",
                "title": "Staff should not raise student complaint",
                "description": "Restricted route",
                "priority": "3",
            },
            format='json'
        )

        assert response.status_code in (400, 403)
        assert "student" in str(response.json()).lower()

    def test_resolve_via_put_auto_closes_complaint(
        self,
        api_client: APIClient,
        user_factory,
    ):
        from apps.colleges.models import College

        college = College.objects.create(name="Resolve College", code="RES001", is_active=True)
        student = user_factory(
            username="API_COMPLAINT_RESOLVE",
            registration_number="API_COMPLAINT_RESOLVE",
            password="ComplaintPass123",
            role="student",
            student_type="hosteller",
            college=college,
            is_password_changed=True,
        )
        api_client.force_authenticate(user=student)

        list_url = reverse('complaints:complaint-list')
        create_response = api_client.post(
            list_url,
            data={
                "category": "electrical",
                "title": "Fan issue",
                "description": "Fan not spinning",
                "priority": "2",
            },
            format='json',
        )
        assert create_response.status_code == 201
        complaint_id = create_response.json()["id"]

        detail_url = reverse('complaints:complaint-detail', kwargs={'pk': complaint_id})
        update_response = api_client.put(
            detail_url,
            data={
                "category": "electrical",
                "title": "Fan issue fixed",
                "description": "Issue resolved",
                "priority": "2",
                "status": "resolved",
            },
            format='json',
        )

        assert update_response.status_code == 200
        payload = update_response.json()
        assert payload["status"] == "closed"

        from apps.complaints.models import ComplaintUpdate
        assert ComplaintUpdate.objects.filter(
            complaint_id=complaint_id,
            status_from='resolved',
            status_to='closed',
        ).exists()

    def test_escalation_moves_assigned_warden_to_head_warden(
        self,
        api_client: APIClient,
        user_factory,
        building_factory,
        room_factory,
        allocation_factory,
    ):
        from apps.colleges.models import College
        from apps.complaints.models import Complaint

        college = College.objects.create(name="Escalation College", code="ESC001", is_active=True)

        student = user_factory(
            username="API_ESC_STUDENT",
            registration_number="API_ESC_STUDENT",
            password="ComplaintPass123",
            role="student",
            student_type="hosteller",
            college=college,
            is_password_changed=True,
        )

        building = building_factory(name="Esc Block", code="ESCBLK")
        room = room_factory(building=building, room_number="E-101")
        if not student.room_allocations.filter(end_date__isnull=True).exists():
            allocation_factory(student=student, room=room)

        warden = user_factory(
            username="API_ESC_WARDEN",
            registration_number="API_ESC_WARDEN",
            password="ComplaintPass123",
            role="warden",
            college=college,
            is_password_changed=True,
        )
        warden.assigned_blocks.add(building)

        head_warden = user_factory(
            username="API_ESC_HEAD",
            registration_number="API_ESC_HEAD",
            password="ComplaintPass123",
            role="head_warden",
            college=college,
            is_password_changed=True,
        )

        api_client.force_authenticate(user=student)
        list_url = reverse('complaints:complaint-list')
        create_response = api_client.post(
            list_url,
            data={
                "category": "electrical",
                "title": "Escalation test",
                "description": "Needs escalation",
                "priority": "1",
            },
            format='json',
        )
        assert create_response.status_code == 201
        complaint_id = create_response.json()["id"]

        complaint = Complaint.objects.get(id=complaint_id)
        assert complaint.assigned_to_id == warden.id
        assert complaint.escalation_level == 1

        api_client.force_authenticate(user=warden)
        escalate_url = reverse('complaints:complaint-escalate', kwargs={'pk': complaint_id})
        escalate_response = api_client.post(escalate_url, data={}, format='json')

        assert escalate_response.status_code == 200
        complaint.refresh_from_db()
        assert complaint.assigned_to_id == head_warden.id
        assert complaint.escalation_level == 2
