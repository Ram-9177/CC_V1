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
        
        user = user_factory(
            username="API_COMPLAINT_MGMT",
            registration_number="API_COMPLAINT_MGMT",
            password="ComplaintPass123",
            role="warden",
            college=college,
            is_password_changed=True,
        )
        api_client.force_authenticate(user=user)

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
            "severity": "high",
        }
        create_response = api_client.post(
            list_url,
            data=create_payload,
            format='json'
        )
        assert create_response.status_code == 201
        created = create_response.json()
        assert_json_keys(created, ["id", "category", "title", "description", "severity", "status"])
        complaint_id = created["id"]

        detail_url = reverse('complaints:complaint-detail', kwargs={'pk': complaint_id})
        update_payload = {
            "category": "electrical",
            "title": "Tube light replaced request",
            "description": "Please replace with a new LED.",
            "severity": "critical",
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
        assert updated["severity"] == "critical"
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
            role="warden",
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
        assert "title" in payload

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

    def test_student_restricted_from_creating_complaints(
        self,
        api_client: APIClient,
        user_factory,
    ):
        # Create a regular student
        student = user_factory(
            username="STRICT_STUDENT",
            registration_number="STRICT_STUDENT",
            password="StudentPass123",
            role="student",
            is_password_changed=True,
        )
        api_client.force_authenticate(user=student)

        list_url = reverse('complaints:complaint-list')
        # Try to create a complaint (Toggle is False by default in clean cache)
        response = api_client.post(
            list_url,
            data={
                "category": "plumbing",
                "title": "Tap leaking",
                "description": "Tap in washroom is leaking.",
            },
            format='json'
        )

        assert response.status_code == 403
        assert "student complaints are currently disabled" in response.json().get("detail", "").lower()
