from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from core.date_utils import parse_iso_date_or_none
from core.role_scopes import get_warden_building_ids, user_is_top_level_management


@pytest.mark.unit
class TestParseIsoDateOrNone:
    def test_returns_date_for_valid_iso_string(self):
        assert parse_iso_date_or_none("2026-02-13") == date(2026, 2, 13)

    @pytest.mark.parametrize("value", [None, "", 0, False])
    def test_returns_none_for_empty_or_falsey_values(self, value):
        assert parse_iso_date_or_none(value) is None

    @pytest.mark.parametrize("value", ["2026-13-01", "2026-02-30", "13-02-2026", "bad-date"])
    def test_returns_none_for_invalid_date_strings(self, value):
        assert parse_iso_date_or_none(value) is None

    @pytest.mark.parametrize("value", [123, 12.5, object(), True, date(2026, 2, 13)])
    def test_raises_type_error_for_truthy_non_string_inputs(self, value):
        with pytest.raises(TypeError):
            parse_iso_date_or_none(value)


@pytest.mark.unit
class TestUserIsTopLevelManagement:
    @pytest.mark.parametrize("role", ["super_admin", "admin", "head_warden"])
    def test_true_for_top_level_roles(self, role):
        user = SimpleNamespace(role=role)
        assert user_is_top_level_management(user) is True

    @pytest.mark.parametrize("role", ["student", "warden", "staff", "chef", "gate_security", None])
    def test_false_for_non_top_level_roles(self, role):
        user = SimpleNamespace(role=role)
        assert user_is_top_level_management(user) is False

    @pytest.mark.parametrize("value", [None, "", 0, object(), SimpleNamespace()])
    def test_false_for_invalid_objects(self, value):
        assert user_is_top_level_management(value) is False


@pytest.mark.django_db
@pytest.mark.unit
class TestGetWardenBuildingIds:
    def test_returns_empty_for_none_user(self):
        assert list(get_warden_building_ids(None)) == []

    def test_returns_empty_for_non_warden(self, user_factory):
        staff = user_factory(role="staff", username="STAFF_SCOPE")
        assert list(get_warden_building_ids(staff)) == []

    def test_returns_only_active_allocations(self, user_factory, building_factory, room_factory, allocation_factory):
        warden = user_factory(role="warden", username="WARDEN_SCOPE")
        old_building = building_factory(code="OLDBLK")
        active_building = building_factory(code="ACTBLK")

        old_room = room_factory(building=old_building, room_number="O-101")
        active_room = room_factory(building=active_building, room_number="A-101")

        allocation_factory(student=warden, room=old_room, end_date=date.today() - timedelta(days=1))
        allocation_factory(student=warden, room=active_room, end_date=None)

        building_ids = list(get_warden_building_ids(warden))
        assert building_ids == [active_building.id]

    def test_warden_like_object_without_model_context_raises(self):
        fake_warden = SimpleNamespace(role="warden")
        with pytest.raises((TypeError, ValueError)):
            list(get_warden_building_ids(fake_warden))
