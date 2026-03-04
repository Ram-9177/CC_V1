from __future__ import annotations

import pytest
from requests import Session

from tests.utils import assert_json_keys, auth_headers, login_and_get_tokens


@pytest.mark.django_db(transaction=True)
@pytest.mark.api
class TestComplaintsAPIWithRequests:
    def _create_management_and_token(self, requests_session: Session, live_api_base_url: str, user_factory) -> str:
        user_factory(
            username="API_COMPLAINT_MGMT",
            registration_number="API_COMPLAINT_MGMT",
            password="ComplaintPass123",
            role="warden",
            is_password_changed=True,
        )
        tokens = login_and_get_tokens(
            requests_session,
            live_api_base_url,
            hall_ticket="API_COMPLAINT_MGMT",
            password="ComplaintPass123",
        )
        return tokens["access"]

    def test_complaint_crud_flow_get_post_put_delete(
        self,
        requests_session: Session,
        live_api_base_url: str,
        user_factory,
    ):
        access_token = self._create_management_and_token(requests_session, live_api_base_url, user_factory)
        headers = auth_headers(access_token)

        list_response = requests_session.get(f"{live_api_base_url}/complaints/", headers=headers, timeout=20)
        assert list_response.status_code == 200
        list_payload = list_response.json()
        assert "results" in list_payload

        create_payload = {
            "category": "electrical",
            "title": "Tube light not working",
            "description": "Room light failed at night.",
            "severity": "high",
        }
        create_response = requests_session.post(
            f"{live_api_base_url}/complaints/",
            json=create_payload,
            headers=headers,
            timeout=20,
        )
        assert create_response.status_code == 201
        created = create_response.json()
        assert_json_keys(created, ["id", "category", "title", "description", "severity", "status"])
        complaint_id = created["id"]

        update_payload = {
            "category": "electrical",
            "title": "Tube light replaced request",
            "description": "Please replace with a new LED.",
            "severity": "critical",
            "status": "in_progress",
        }
        put_response = requests_session.put(
            f"{live_api_base_url}/complaints/{complaint_id}/",
            json=update_payload,
            headers=headers,
            timeout=20,
        )
        assert put_response.status_code == 200
        updated = put_response.json()
        assert updated["title"] == "Tube light replaced request"
        assert updated["severity"] == "critical"
        assert updated["status"] == "in_progress"

        delete_response = requests_session.delete(
            f"{live_api_base_url}/complaints/{complaint_id}/",
            headers=headers,
            timeout=20,
        )
        assert delete_response.status_code == 204

        not_found_response = requests_session.get(
            f"{live_api_base_url}/complaints/{complaint_id}/",
            headers=headers,
            timeout=20,
        )
        assert not_found_response.status_code == 404

    def test_create_complaint_rejects_invalid_payload(
        self,
        requests_session: Session,
        live_api_base_url: str,
        user_factory,
    ):
        access_token = self._create_management_and_token(requests_session, live_api_base_url, user_factory)
        headers = auth_headers(access_token)

        invalid_payload = {
            "category": "electrical",
            "description": "Missing title should fail",
            "severity": "medium",
        }

        response = requests_session.post(
            f"{live_api_base_url}/complaints/",
            json=invalid_payload,
            headers=headers,
            timeout=20,
        )

        assert response.status_code == 400
        payload = response.json()
        assert "title" in payload

    def test_create_complaint_without_auth_returns_401(self, requests_session: Session, live_api_base_url: str):
        response = requests_session.post(
            f"{live_api_base_url}/complaints/",
            json={
                "category": "internet",
                "title": "No internet",
                "description": "Wi-Fi down",
                "severity": "high",
            },
            timeout=20,
        )

        assert response.status_code == 401

    def test_student_restricted_from_creating_complaints(
        self,
        requests_session: Session,
        live_api_base_url: str,
        user_factory,
    ):
        # Create a regular student
        user_factory(
            username="STRICT_STUDENT",
            registration_number="STRICT_STUDENT",
            password="StudentPass123",
            role="student",
            is_password_changed=True,
        )
        tokens = login_and_get_tokens(
            requests_session,
            live_api_base_url,
            hall_ticket="STRICT_STUDENT",
            password="StudentPass123",
        )
        headers = auth_headers(tokens["access"])

        # Try to create a complaint (Toggle is False by default in clean cache)
        response = requests_session.post(
            f"{live_api_base_url}/complaints/",
            json={
                "category": "plumbing",
                "title": "Tap leaking",
                "description": "Tap in washroom is leaking.",
            },
            headers=headers,
            timeout=20,
        )

        assert response.status_code == 403
        assert "student complaints are currently disabled" in response.json().get("detail", "").lower()
