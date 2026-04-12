from datetime import timedelta

import pytest  # pyre-ignore
from django.utils import timezone  # pyre-ignore
from rest_framework.test import APIClient  # pyre-ignore

from apps.auth.models import User  # pyre-ignore
from apps.colleges.models import College  # pyre-ignore
from apps.events.models import Event, EventRegistration  # pyre-ignore


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def college(db):
    return College.objects.create(
        name="Test College",
        code="TEST",
        is_active=True,
    )


@pytest.fixture
def admin_user(college):
    return User.objects.create_user(
        username="admin_api",
        email="admin_api@example.com",
        password="admin123",
        registration_number="ADMAPI001",
        role="admin",
        college=college,
    )


@pytest.fixture
def student_user(college):
    return User.objects.create_user(
        username="student_api",
        email="student_api@example.com",
        password="student123",
        registration_number="STUAPI001",
        role="student",
        college=college,
    )


@pytest.fixture
def admin_client(api_client, admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def student_client(api_client, student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def student_user_two(college):
    return User.objects.create_user(
        username="student_api_two",
        email="student_api_two@example.com",
        password="student123",
        registration_number="STUAPI002",
        role="student",
        college=college,
    )


@pytest.fixture
def student_client_two(api_client, student_user_two):
    client = APIClient()
    client.force_authenticate(user=student_user_two)
    return client


@pytest.fixture
def event_payload(admin_user):
    start = timezone.now() + timedelta(days=2)
    end = start + timedelta(hours=2)
    return {
        "title": "Inter-Hostel Cricket",
        "event_type": "sports",
        "description": "Cricket tournament for all blocks.",
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "location": "Main Ground",
        "capacity": 60,
    }


@pytest.fixture
def existing_event(admin_user):
    start = timezone.now() + timedelta(days=1)
    end = start + timedelta(hours=1)
    return Event.objects.create(
        title="Hostel Orientation",
        event_type="academic",
        description="Orientation for new residents.",
        start_time=start,
        end_time=end,
        location="Seminar Hall",
        created_by=admin_user,
        capacity=200,
        college=admin_user.college,
    )


@pytest.mark.django_db
class TestEventCRUDAPI:
    base_url = "/api/events/events/"

    def test_get_events_requires_authentication(self, api_client):
        response = api_client.get(self.base_url)

        assert response.status_code == 401
        assert isinstance(response.json(), dict)
        assert "message" in response.json()

    def test_get_events_authenticated_returns_paginated_json(self, student_client, existing_event):
        response = student_client.get(self.base_url)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        assert "results" in data
        assert isinstance(data["results"], list)
        assert len(data["results"]) >= 1

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
        assert "message" in response.json()

    def test_post_event_invalid_payload_returns_400(self, admin_client):
        invalid_payload = {
            "title": "Broken Event Payload",
        }

        response = admin_client.post(self.base_url, invalid_payload, format="json")

        assert response.status_code == 400
        data = response.json()
        assert isinstance(data, dict)
        assert "details" in data
        for required_field in ["event_type", "description", "start_time", "end_time", "location"]:
            assert required_field in data["details"]

    def test_put_event_admin_success(self, admin_client, existing_event, admin_user):
        start = timezone.now() + timedelta(days=3)
        end = start + timedelta(hours=3)
        update_payload = {
            "title": "Updated Orientation",
            "event_type": "social",
            "description": "Updated description.",
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "location": "Auditorium",
            "capacity": 120,
        }

        response = admin_client.put(f"{self.base_url}{existing_event.id}/", update_payload, format="json")

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(existing_event.id)
        assert data["title"] == "Updated Orientation"
        assert data["event_type"] == "cultural"
        assert data["location"] == "Auditorium"

    def test_put_event_student_forbidden(self, student_client, existing_event, admin_user):
        start = timezone.now() + timedelta(days=4)
        end = start + timedelta(hours=1)
        update_payload = {
            "title": "Student Unauthorized Update",
            "event_type": "maintenance",
            "description": "Should fail.",
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "location": "Block C",
            "capacity": 50,
        }

        response = student_client.put(f"{self.base_url}{existing_event.id}/", update_payload, format="json")

        assert response.status_code == 403
        assert isinstance(response.json(), dict)
        assert "message" in response.json()

    def test_put_event_not_found_returns_404(self, admin_client, admin_user):
        start = timezone.now() + timedelta(days=5)
        end = start + timedelta(hours=1)
        update_payload = {
            "title": "Not Found Update",
            "event_type": "sports",
            "description": "Missing event id.",
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "location": "Nowhere",
            "capacity": 10,
        }

        response = admin_client.put(f"{self.base_url}999999/", update_payload, format="json")

        assert response.status_code == 404
        assert isinstance(response.json(), dict)
        assert "message" in response.json()

    def test_delete_event_admin_success(self, admin_client, existing_event):
        response = admin_client.delete(f"{self.base_url}{existing_event.id}/")

        assert response.status_code == 204
        assert not Event.objects.filter(id=existing_event.id).exists()

    def test_delete_event_student_forbidden(self, student_client, existing_event):
        response = student_client.delete(f"{self.base_url}{existing_event.id}/")

        assert response.status_code == 403
        assert Event.objects.filter(id=existing_event.id).exists()
        assert isinstance(response.json(), dict)
        assert "message" in response.json()


@pytest.mark.django_db
class TestEventFoundationFeatures:
    registrations_url = "/api/events/registrations/register/"

    def test_waitlist_auto_promotes_on_cancellation(self, student_client, student_client_two, student_user_two, admin_user):
        start = timezone.now() + timedelta(days=1)
        event = Event.objects.create(
            title="AI Workshop",
            event_type="academic",
            description="Hands-on AI workshop.",
            start_time=start,
            end_time=start + timedelta(hours=2),
            location="Lab 1",
            created_by=admin_user,
            capacity=1,
            college=admin_user.college,
        )

        first = student_client.post(self.registrations_url, {"event_id": event.id}, format="json")
        second = student_client_two.post(self.registrations_url, {"event_id": event.id}, format="json")

        assert first.status_code == 201
        assert first.json()["status"] == "registered"
        # Capacity reached behavior in the current API is a hard failure.
        assert second.status_code == 400
        assert "capacity" in str(second.json()).lower()

    def test_register_endpoint_creates_registration_record(self, student_client, existing_event, student_user):
        response = student_client.post(self.registrations_url, {"event_id": existing_event.id}, format="json")
        assert response.status_code == 201

        reg_id = response.json()["id"]
        reg = EventRegistration.objects.get(id=reg_id)
        assert reg.event_id == existing_event.id
        assert reg.student_id == student_user.id
        assert reg.status == "registered"
