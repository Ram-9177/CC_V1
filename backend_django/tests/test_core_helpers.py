import itertools
from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from apps.auth.models import User
from apps.rooms.models import Building, Room, RoomAllocation
from core.date_utils import parse_iso_date_or_none
from core.role_scopes import get_warden_building_ids, user_is_top_level_management


@pytest.fixture
def user_factory(db):
    counter = itertools.count(1)

    def _create_user(**overrides):
        idx = next(counter)
        defaults = {
            "username": f"user{idx}",
            "password": "testpass123",
            "registration_number": f"REG{idx:04d}",
            "role": "student",
            "email": f"user{idx}@example.com",
        }
        defaults.update(overrides)
        return User.objects.create_user(**defaults)

    return _create_user


@pytest.fixture
def building_factory(db):
    counter = itertools.count(1)

    def _create_building(**overrides):
        idx = next(counter)
        defaults = {
            "name": f"Building {idx}",
            "code": f"B{idx:03d}",
            "total_floors": 3,
        }
        defaults.update(overrides)
        return Building.objects.create(**defaults)

    return _create_building


@pytest.fixture
def room_factory(db, building_factory):
    counter = itertools.count(1)

    def _create_room(**overrides):
        idx = next(counter)
        defaults = {
            "room_number": f"R{idx:03d}",
            "building": building_factory(),
            "floor": 1,
            "room_type": "single",
            "capacity": 1,
            "current_occupancy": 0,
        }
        defaults.update(overrides)
        return Room.objects.create(**defaults)

    return _create_room


@pytest.fixture
def allocation_factory(db, room_factory):
    def _create_allocation(student, **overrides):
        defaults = {
            "student": student,
            "room": room_factory(),
            "allocated_date": date.today(),
            "status": "approved",
        }
        defaults.update(overrides)
        return RoomAllocation.objects.create(**defaults)

    return _create_allocation


class TestParseIsoDateOrNone:
    def test_returns_date_for_valid_iso_string(self):
        assert parse_iso_date_or_none("2026-02-13") == date(2026, 2, 13)

    @pytest.mark.parametrize("value", [None, ""])
    def test_returns_none_for_empty_inputs(self, value):
        assert parse_iso_date_or_none(value) is None

    @pytest.mark.parametrize(
        "value",
        [
            "2026-13-01",  # invalid month
            "2026-02-30",  # invalid day
            "13-02-2026",  # wrong format
            "not-a-date",
        ],
    )
    def test_returns_none_for_invalid_date_strings(self, value):
        assert parse_iso_date_or_none(value) is None

    @pytest.mark.parametrize("value", [[], {}, 0, False])
    def test_returns_none_for_falsey_non_string_inputs(self, value):
        assert parse_iso_date_or_none(value) is None

    @pytest.mark.parametrize("value", [123, 12.5, object(), True, date(2026, 2, 13)])
    def test_raises_type_error_for_truthy_non_string_inputs(self, value):
        with pytest.raises(TypeError):
            parse_iso_date_or_none(value)


class TestUserIsTopLevelManagement:
    @pytest.mark.parametrize("role", ["admin", "super_admin", "head_warden"])
    def test_true_for_top_level_roles(self, role):
        user = SimpleNamespace(role=role)
        assert user_is_top_level_management(user) is True

    @pytest.mark.parametrize(
        "role",
        ["student", "staff", "warden", "chef", "gate_security", "security_head", None],
    )
    def test_false_for_non_top_level_roles(self, role):
        user = SimpleNamespace(role=role)
        assert user_is_top_level_management(user) is False

    @pytest.mark.parametrize("value", [None, 0, "", object(), SimpleNamespace()])
    def test_false_for_missing_or_invalid_user_objects(self, value):
        assert user_is_top_level_management(value) is False


@pytest.mark.django_db
class TestGetWardenBuildingIds:
    def test_returns_empty_for_none_user(self):
        result = get_warden_building_ids(None)
        assert list(result) == []

    def test_returns_empty_for_non_warden_user(self, user_factory):
        staff_user = user_factory(role="staff")
        result = get_warden_building_ids(staff_user)
        assert list(result) == []

    def test_returns_empty_for_warden_without_assignments(self, user_factory):
        warden = user_factory(role="warden")
        result = get_warden_building_ids(warden)
        assert list(result) == []

    def test_returns_explicit_assigned_building_ids(
        self,
        user_factory,
        building_factory,
    ):
        warden = user_factory(role="warden")
        old_building = building_factory(code="OLD1")
        active_building = building_factory(code="ACT1")
        warden.assigned_blocks.add(old_building, active_building)

        result = list(get_warden_building_ids(warden))
        assert sorted(result) == sorted([old_building.id, active_building.id])

    def test_college_wide_override_returns_all_blocks_for_college(self, user_factory, building_factory):
        from apps.colleges.models import College

        college = College.objects.create(name="Scope College", code="SC1", is_active=True)
        other_college = College.objects.create(name="Other Scope College", code="SC2", is_active=True)
        b1 = building_factory(code="SC1-A", college=college)
        b2 = building_factory(code="SC1-B", college=college)
        building_factory(code="SC2-A", college=other_college)

        warden = user_factory(role="warden", college=college, can_access_all_blocks=True)
        result = sorted(get_warden_building_ids(warden))
        assert result == sorted([b1.id, b2.id])

    def test_invalid_warden_like_object_raises_error(self):
        fake_warden = SimpleNamespace(role="warden")
        with pytest.raises((TypeError, ValueError)):
            list(get_warden_building_ids(fake_warden))
