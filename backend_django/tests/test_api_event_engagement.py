from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.auth.models import User
from apps.colleges.models import College
from apps.events.models import Event, EventRegistration


@pytest.fixture
def college(db):
    return College.objects.create(name="Events Test College", code="ETC")


@pytest.fixture
def admin_user(db, college):
    return User.objects.create_user(
        username="admin_events_eng",
        email="admin_events_eng@example.com",
        password="admin123",
        registration_number="ADMENG001",
        role="admin",
        college=college,
    )


@pytest.fixture
def student_user(db, college):
    return User.objects.create_user(
        username="student_events_eng",
        email="student_events_eng@example.com",
        password="student123",
        registration_number="STUENG001",
        role="student",
        college=college,
    )


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def points_event(admin_user, college):
    start = timezone.now() + timedelta(days=1)
    return Event.objects.create(
        title="AI Challenge",
        event_type="academic",
        description="Campus AI competition",
        start_time=start,
        end_time=start + timedelta(hours=2),
        location="Innovation Lab",
        created_by=admin_user,
        college=college,
        capacity=50,
    )


@pytest.mark.django_db
class TestEventRegistrationFlow:
    def test_register_then_mark_attended(self, student_client, points_event, admin_user, student_user):
        register = student_client.post(
            "/api/events/registrations/register/",
            {"event_id": points_event.id},
            format="json",
        )
        assert register.status_code == 201
        registration_id = register.json()["id"]

        # Student should see own registration in listing endpoint.
        listing = student_client.get("/api/events/registrations/")
        assert listing.status_code == 200
        results = listing.json().get("results", listing.json())
        assert any(item["id"] == registration_id for item in results)

        admin_client = APIClient()
        admin_client.force_authenticate(user=admin_user)
        attended = admin_client.post(f"/api/events/registrations/{registration_id}/mark_attended/")
        assert attended.status_code == 200

        registration = EventRegistration.objects.get(id=registration_id)
        assert registration.student_id == student_user.id
        assert registration.status == "attended"
        assert registration.attended_at is not None
