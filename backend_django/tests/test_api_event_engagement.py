from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.auth.models import User
from apps.events.models import Event, EventTicket


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username="admin_events_eng",
        email="admin_events_eng@example.com",
        password="admin123",
        registration_number="ADMENG001",
        role="admin",
    )


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        username="student_events_eng",
        email="student_events_eng@example.com",
        password="student123",
        registration_number="STUENG001",
        role="student",
    )


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.fixture
def points_event(admin_user):
    start = timezone.now() + timedelta(days=1)
    return Event.objects.create(
        title="AI Challenge",
        event_type="educational",
        description="Campus AI competition",
        start_date=start,
        end_date=start + timedelta(hours=2),
        location="Innovation Lab",
        organizer=admin_user,
        enable_points=True,
        points_value=20,
        allow_registration=True,
    )


@pytest.mark.django_db
class TestEventPointsAndLeaderboard:
    def test_attendance_awards_points_and_leaderboard_lists_student(self, student_client, points_event, student_user):
        register = student_client.post("/api/events/registrations/register/", {"event_id": points_event.id}, format="json")
        assert register.status_code == 201

        registration_id = register.json()["id"]
        attended = student_client.post(f"/api/events/registrations/{registration_id}/mark_attended/")
        assert attended.status_code == 200

        mine = student_client.get("/api/events/activity-points/mine/")
        assert mine.status_code == 200
        assert mine.json()["total_points"] == 20

        leaderboard = student_client.get("/api/events/events/leaderboard/?limit=10")
        assert leaderboard.status_code == 200
        assert any(row["student_id"] == student_user.id and row["total_points"] >= 20 for row in leaderboard.json())


@pytest.mark.django_db
class TestEventFeedbackAnalytics:
    def test_feedback_submission_and_analytics(self, student_client, points_event):
        register = student_client.post("/api/events/registrations/register/", {"event_id": points_event.id}, format="json")
        assert register.status_code == 201

        feedback = student_client.post(
            "/api/events/feedback/",
            {"event": points_event.id, "rating": 5, "comment": "Excellent session"},
            format="json",
        )
        assert feedback.status_code == 201

        analytics = student_client.get(f"/api/events/feedback/analytics/?event_id={points_event.id}")
        assert analytics.status_code == 200
        payload = analytics.json()
        assert payload["total_feedback"] == 1
        assert payload["average_rating"] == 5.0
        assert payload["rating_breakdown"]["5"] == 1


@pytest.mark.django_db
class TestEventTicketing:
    def test_ticket_issue_payment_and_qr_validation(self, student_client, admin_client, admin_user):
        start = timezone.now() + timedelta(days=1)
        event = Event.objects.create(
            title="Premium Concert",
            event_type="cultural",
            description="Paid concert event",
            start_date=start,
            end_date=start + timedelta(hours=3),
            location="Main Stage",
            organizer=admin_user,
            allow_registration=True,
            enable_tickets=True,
            ticket_price=299,
        )

        register = student_client.post("/api/events/registrations/register/", {"event_id": event.id}, format="json")
        assert register.status_code == 201

        create_ticket = student_client.post("/api/events/tickets/", {"event": event.id}, format="json")
        assert create_ticket.status_code == 201
        ticket_id = create_ticket.json()["id"]
        qr_token = create_ticket.json()["qr_token"]

        pay = admin_client.post(
            f"/api/events/tickets/{ticket_id}/update_payment/",
            {"payment_status": "paid", "payment_reference": "PAY-OK-123"},
            format="json",
        )
        assert pay.status_code == 200

        validate = admin_client.post(
            "/api/events/tickets/validate_qr/",
            {"qr_token": qr_token, "consume": True},
            format="json",
        )
        assert validate.status_code == 200
        assert validate.json()["valid"] is True
        assert validate.json()["ticket_status"] == "used"

        ticket = EventTicket.objects.get(id=ticket_id)
        assert ticket.payment_status == "paid"
        assert ticket.ticket_status == "used"
