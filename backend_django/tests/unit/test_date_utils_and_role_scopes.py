from __future__ import annotations

from datetime import date, timedelta
from types import SimpleNamespace

import pytest

from core.date_utils import parse_iso_date_or_none
from core.role_scopes import get_scoped_building_floor_pairs, get_warden_building_ids, has_scope_access, user_is_top_level_management


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

    def test_returns_explicit_assigned_blocks(self, user_factory, building_factory):
        warden = user_factory(role="warden", username="WARDEN_SCOPE")
        b1 = building_factory(code="BLK1")
        b2 = building_factory(code="BLK2")
        warden.assigned_blocks.add(b1, b2)

        building_ids = sorted(get_warden_building_ids(warden))
        assert building_ids == sorted([b1.id, b2.id])

    def test_returns_all_college_blocks_when_override_enabled(self, user_factory, building_factory):
        from apps.colleges.models import College

        college = College.objects.create(name="Role Scope College", code="RSC", is_active=True)
        warden = user_factory(role="warden", username="WARDEN_SCOPE_ALL", college=college, can_access_all_blocks=True)
        in_college_a = building_factory(code="BLK3", college=college)
        in_college_b = building_factory(code="BLK4", college=college)
        out_college = College.objects.create(name="Other Role Scope College", code="ORSC", is_active=True)
        building_factory(code="BLK5", college=out_college)

        building_ids = sorted(get_warden_building_ids(warden))
        assert building_ids == sorted([in_college_a.id, in_college_b.id])

    def test_warden_like_object_without_model_context_raises(self):
        fake_warden = SimpleNamespace(role="warden")
        with pytest.raises((TypeError, ValueError)):
            list(get_warden_building_ids(fake_warden))


@pytest.mark.django_db
@pytest.mark.unit
class TestStrictBuildingFloorScope:
    def test_warden_with_blocks_but_no_floor_map_has_no_scope_access(self, user_factory, building_factory):
        warden = user_factory(role="warden", username="WARDEN_NO_FLOOR_SCOPE")
        building = building_factory(code="BLK_NO_FLOOR_SCOPE")
        warden.assigned_blocks.add(building)

        assert has_scope_access(warden, building_id=building.id) is False
        assert has_scope_access(warden, building_id=building.id, floor=1) is False

    def test_warden_scope_access_uses_per_building_floor_map(self, user_factory, building_factory):
        warden = user_factory(role="warden", username="WARDEN_STRICT_SCOPE")
        b1 = building_factory(code="BLK_SCOPE_1")
        b2 = building_factory(code="BLK_SCOPE_2")

        warden.assigned_blocks.add(b1, b2)
        warden.assigned_floors_by_block = {
            str(b1.id): [1, 2],
            str(b2.id): [3],
        }
        warden.save(update_fields=['assigned_floors_by_block'])

        scoped_pairs = get_scoped_building_floor_pairs(warden)
        assert scoped_pairs[str(b1.id)] == [1, 2]
        assert scoped_pairs[str(b2.id)] == [3]

        assert has_scope_access(warden, building_id=b1.id, floor=1) is True
        assert has_scope_access(warden, building_id=b1.id, floor=3) is False
        assert has_scope_access(warden, building_id=b2.id, floor=3) is True
