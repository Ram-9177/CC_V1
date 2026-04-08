from __future__ import annotations

import itertools
from datetime import date, timedelta
from typing import Callable, Generator

import pytest
import requests
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.auth.models import User
from apps.complaints.models import Complaint
from apps.gate_passes.models import GatePass
from apps.messages.models import Message
from apps.rooms.models import Bed, Building, Room, RoomAllocation
from apps.sports.models import CourtSlot, Sport, SportCourt
from core.security import RateLimiter


@pytest.fixture(autouse=True)
def _reset_in_memory_rate_limiter() -> Generator[None, None, None]:
    """Keep tests deterministic when RateLimiter static state is used."""
    RateLimiter._request_counts.clear()
    yield
    RateLimiter._request_counts.clear()


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def user_factory(db) -> Callable[..., User]:
    counter = itertools.count(1)

    def _create_user(**overrides) -> User:
        idx = next(counter)
        username = overrides.pop("username", f"USER{idx}")
        password = overrides.pop("password", "password123")
        defaults = {
            "username": username,
            "registration_number": overrides.pop("registration_number", username),
            "email": overrides.pop("email", f"user{idx}@example.com"),
            "first_name": overrides.pop("first_name", "Test"),
            "last_name": overrides.pop("last_name", f"User{idx}"),
            "role": overrides.pop("role", "student"),
            "is_active": overrides.pop("is_active", True),
            "is_password_changed": overrides.pop("is_password_changed", True),
        }
        defaults.update(overrides)
        return get_user_model().objects.create_user(password=password, **defaults)

    return _create_user


@pytest.fixture
def role_users(user_factory):
    return {
        "student": user_factory(username="STUDENT1", role="student"),
        "warden": user_factory(username="WARDEN1", role="warden"),
        "head_warden": user_factory(username="HEADWARDEN1", role="head_warden"),
        "staff": user_factory(username="STAFF1", role="staff"),
        "admin": user_factory(username="ADMIN1", role="admin"),
        "super_admin": user_factory(username="SUPERADMIN1", role="super_admin"),
        "gate_security": user_factory(username="SECURITY1", role="gate_security"),
        "security_head": user_factory(username="SECURITYHEAD1", role="security_head"),
        "chef": user_factory(username="CHEF1", role="chef"),
        "pt": user_factory(username="PT1", role="pt"),
        "pd": user_factory(username="PD1", role="pd"),
    }


@pytest.fixture
def authenticated_user(user_factory) -> User:
    return user_factory(username="AUTH_USER", role="student")


@pytest.fixture
def admin_user(user_factory) -> User:
    return user_factory(username="AUTH_ADMIN", role="admin")


@pytest.fixture
def authenticated_api_client(api_client: APIClient, authenticated_user: User) -> APIClient:
    api_client.force_authenticate(user=authenticated_user)
    return api_client


@pytest.fixture
def admin_api_client(api_client: APIClient, admin_user: User) -> APIClient:
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def student_client(api_client: APIClient, role_users) -> APIClient:
    api_client.force_authenticate(user=role_users["student"])
    return api_client


@pytest.fixture
def warden_client(api_client: APIClient, role_users) -> APIClient:
    api_client.force_authenticate(user=role_users["warden"])
    return api_client


@pytest.fixture
def pt_client(api_client: APIClient, role_users) -> APIClient:
    api_client.force_authenticate(user=role_users["pt"])
    return api_client


@pytest.fixture
def pd_client(api_client: APIClient, role_users) -> APIClient:
    api_client.force_authenticate(user=role_users["pd"])
    return api_client


@pytest.fixture
def jwt_tokens(authenticated_user: User) -> dict[str, str]:
    refresh = RefreshToken.for_user(authenticated_user)
    return {
        "refresh": str(refresh),
        "access": str(refresh.access_token),
    }


@pytest.fixture
def building_factory(db) -> Callable[..., Building]:
    counter = itertools.count(1)

    def _create_building(**overrides) -> Building:
        idx = next(counter)
        defaults = {
            "name": f"Building {idx}",
            "code": f"B{idx:03d}",
            "description": "Test building",
            "total_floors": 3,
        }
        defaults.update(overrides)
        return Building.objects.create(**defaults)

    return _create_building


@pytest.fixture
def room_factory(db, building_factory, user_factory) -> Callable[..., Room]:
    counter = itertools.count(1)

    def _create_room(**overrides) -> Room:
        idx = next(counter)
        defaults = {
            "room_number": f"R{idx:03d}",
            "building": building_factory(),
            "floor": 1,
            "room_type": "double",
            "capacity": 2,
            "current_occupancy": 0,
            "is_available": True,
            "created_by": user_factory(role="admin", username=f"ROOMADMIN{idx}"),
        }
        defaults.update(overrides)
        return Room.objects.create(**defaults)

    return _create_room


@pytest.fixture
def bed_factory(db, room_factory) -> Callable[..., Bed]:
    counter = itertools.count(1)

    def _create_bed(**overrides) -> Bed:
        idx = next(counter)
        defaults = {
            "room": room_factory(),
            "bed_number": f"B{idx}",
            "is_occupied": False,
        }
        defaults.update(overrides)
        return Bed.objects.create(**defaults)

    return _create_bed


@pytest.fixture
def allocation_factory(db, room_factory, bed_factory) -> Callable[..., RoomAllocation]:
    def _create_allocation(student: User, **overrides) -> RoomAllocation:
        room = overrides.pop("room", room_factory())
        defaults = {
            "student": student,
            "room": room,
            "bed": overrides.pop("bed", None),
            "status": "approved",
            "allocated_date": overrides.pop("allocated_date", date.today()),
            "end_date": overrides.pop("end_date", None),
            "notes": overrides.pop("notes", ""),
        }
        defaults.update(overrides)
        return RoomAllocation.objects.create(**defaults)

    return _create_allocation


@pytest.fixture
def complaint_factory(db) -> Callable[..., Complaint]:
    counter = itertools.count(1)

    def _create_complaint(student: User, **overrides) -> Complaint:
        idx = next(counter)
        defaults = {
            "student": student,
            "category": "electrical",
            "title": f"Complaint {idx}",
            "description": "Test complaint description",
            "status": "open",
            "severity": "medium",
        }
        defaults.update(overrides)
        return Complaint.objects.create(**defaults)

    return _create_complaint


@pytest.fixture
def gate_pass_factory(db) -> Callable[..., GatePass]:
    def _create_gate_pass(student: User, **overrides) -> GatePass:
        defaults = {
            "student": student,
            "pass_type": "day",
            "status": "pending",
            "exit_date": timezone.now() + timedelta(hours=2),
            "entry_date": timezone.now() + timedelta(hours=8),
            "reason": "Family visit",
            "destination": "City",
            "approval_remarks": "",
        }
        defaults.update(overrides)
        return GatePass.objects.create(**defaults)

    return _create_gate_pass


@pytest.fixture
def message_factory(db) -> Callable[..., Message]:
    counter = itertools.count(1)

    def _create_message(sender: User, recipient: User, **overrides) -> Message:
        idx = next(counter)
        defaults = {
            "sender": sender,
            "recipient": recipient,
            "subject": f"Subject {idx}",
            "body": "Message body",
        }
        defaults.update(overrides)
        return Message.objects.create(**defaults)

    return _create_message


@pytest.fixture
def requests_session() -> Generator[requests.Session, None, None]:
    session = requests.Session()
    yield session
    session.close()


@pytest.fixture
def live_api_base_url(live_server) -> str:
    return f"{live_server.url}/api"


# ---------------------------------------------------------------------------
# Sports fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sport_factory(db) -> Callable[..., Sport]:
    counter = itertools.count(1)

    def _create_sport(**overrides) -> Sport:
        idx = next(counter)
        defaults = {
            "name": f"Sport {idx}",
            "min_players": 2,
            "max_players": 10,
            "game_type": "team",
            "status": "active",
        }
        defaults.update(overrides)
        return Sport.objects.create(**defaults)

    return _create_sport


@pytest.fixture
def court_factory(db, sport_factory) -> Callable[..., SportCourt]:
    counter = itertools.count(1)

    def _create_court(**overrides) -> SportCourt:
        idx = next(counter)
        defaults = {
            "sport": sport_factory(),
            "name": f"Court {idx}",
            "location": f"Block {idx}",
            "capacity": 10,
            "status": "open",
        }
        defaults.update(overrides)
        return SportCourt.objects.create(**defaults)

    return _create_court


@pytest.fixture
def slot_factory(db, court_factory) -> Callable[..., CourtSlot]:
    counter = itertools.count(1)

    def _create_slot(**overrides) -> CourtSlot:
        idx = next(counter)
        # Spread slots across future days so unique_together never clashes
        slot_date = overrides.pop("date", date.today() + timedelta(days=idx))
        defaults = {
            "court": court_factory(),
            "date": slot_date,
            "start_time": "07:00:00",
            "end_time": "08:00:00",
            "max_players": 10,
        }
        defaults.update(overrides)
        return CourtSlot.objects.create(**defaults)

    return _create_slot
