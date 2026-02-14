from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.auth.models import User
from apps.events.models import Event


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin_api",
        email="admin_api@example.com",
        password="admin123",
        registration_number="ADMAPI001",
        role="admin",
    )


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        username="student_api",
        email="student_api@example.com",
        password="student123",
        registration_number="STUAPI001",
        role="student",
    )


@pytest.fixture
def admin_client(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def student_client(api_client, student_user):
    api_client.force_authenticate(user=student_user)
    return api_client


@pytest.fixture
def event_payload(admin_user):
    start = timezone.now() + timedelta(days=2)
    end = start + timedelta(hours=2)
    return {
        "title": "Inter-Hostel Cricket",
        "event_type": "sports",
        "description": "Cricket tournament for all blocks.",
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "location": "Main Ground",
        "organizer": admin_user.id,
        "max_participants": 60,
        "is_mandatory": False,
    }


@pytest.fixture
def existing_event(admin_user):
    start = timezone.now() + timedelta(days=1)
    end = start + timedelta(hours=1)
    return Event.objects.create(
        title="Hostel Orientation",
        event_type="educational",
        description="Orientation for new residents.",
        start_date=start,
        end_date=end,
        location="Seminar Hall",
        organizer=admin_user,
        max_participants=200,
        is_mandatory=True,
    )


@pytest.mark.django_db
class TestEventCRUDAPI:
    base_url = "/api/events/events/"

    def test_get_events_requires_authentication(self, api_client):
        response = api_client.get(self.base_url)

        assert response.status_code == 401
        assert isinstance(response.json(), dict)
        assert "detail" in response.json()

    def test_get_events_authenticated_returns_paginated_json(self, student_client, existing_event):
        response = student_client.get(self.base_url)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "count" in data
        assert "results" in data
        assert isinstance(data["results"], list)
        assert data["count"] >= 1

        event_item = data["results"][0]
        for key in [
            "id",
            "title",
            "event_type",
            "description",
            "start_date",
            "end_date",
            "location",
            "organizer",
            "max_participants",
            "is_mandatory",
            "registration_count",
        ]:
            assert key in event_item

    def test_post_event_admin_success(self, admin_client, event_payload):
        response = admin_client.post(self.base_url, event_payload, format="json")

        assert response.status_code == 201
        data = response.json()
        assert isinstance(data, dict)
        assert "id" in data
        assert data["title"] == event_payload["title"]
        assert data["event_type"] == event_payload["event_type"]
        assert data["location"] == event_payload["location"]

    def test_post_event_student_forbidden(self, student_client, event_payload):
        response = student_client.post(self.base_url, event_payload, format="json")

        assert response.status_code == 403
        assert isinstance(response.json(), dict)
        assert "detail" in response.json()

    def test_post_event_invalid_payload_returns_400(self, admin_client):
        invalid_payload = {
            "title": "Broken Event Payload",
        }

        response = admin_client.post(self.base_url, invalid_payload, format="json")

        assert response.status_code == 400
        data = response.json()
        assert isinstance(data, dict)
        for required_field in ["event_type", "description", "start_date", "end_date", "location"]:
            assert required_field in data

    def test_put_event_admin_success(self, admin_client, existing_event, admin_user):
        start = timezone.now() + timedelta(days=3)
        end = start + timedelta(hours=3)
        update_payload = {
            "title": "Updated Orientation",
            "event_type": "social",
            "description": "Updated description.",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "location": "Auditorium",
            "organizer": admin_user.id,
            "max_participants": 120,
            "is_mandatory": False,
        }

        response = admin_client.put(f"{self.base_url}{existing_event.id}/", update_payload, format="json")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == existing_event.id
        assert data["title"] == "Updated Orientation"
        assert data["event_type"] == "social"
        assert data["location"] == "Auditorium"
        assert data["is_mandatory"] is False

    def test_put_event_student_forbidden(self, student_client, existing_event, admin_user):
        start = timezone.now() + timedelta(days=4)
        end = start + timedelta(hours=1)
        update_payload = {
            "title": "Student Unauthorized Update",
            "event_type": "maintenance",
            "description": "Should fail.",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "location": "Block C",
            "organizer": admin_user.id,
            "max_participants": 50,
            "is_mandatory": False,
        }

        response = student_client.put(f"{self.base_url}{existing_event.id}/", update_payload, format="json")

        assert response.status_code == 403
        assert isinstance(response.json(), dict)
        assert "detail" in response.json()

    def test_put_event_not_found_returns_404(self, admin_client, admin_user):
        start = timezone.now() + timedelta(days=5)
        end = start + timedelta(hours=1)
        update_payload = {
            "title": "Not Found Update",
            "event_type": "sports",
            "description": "Missing event id.",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "location": "Nowhere",
            "organizer": admin_user.id,
            "max_participants": 10,
            "is_mandatory": False,
        }

        response = admin_client.put(f"{self.base_url}999999/", update_payload, format="json")

        assert response.status_code == 404
        assert isinstance(response.json(), dict)
        assert "detail" in response.json()

    def test_delete_event_admin_success(self, admin_client, existing_event):
        response = admin_client.delete(f"{self.base_url}{existing_event.id}/")

        assert response.status_code == 204
        assert not Event.objects.filter(id=existing_event.id).exists()

    def test_delete_event_student_forbidden(self, student_client, existing_event):
        response = student_client.delete(f"{self.base_url}{existing_event.id}/")

        assert response.status_code == 403
        assert Event.objects.filter(id=existing_event.id).exists()
        assert isinstance(response.json(), dict)
        assert "detail" in response.json()
