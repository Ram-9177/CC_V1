import pytest
from datetime import datetime

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.auth.models import User
from apps.colleges.models import College
from apps.gate_passes.models import GatePass


def _forecast_cache_keys(date_str: str, college_pk: int) -> list[str]:
    keys = []
    for mt in ['all', 'lunch', 'breakfast', 'dinner', 'snacks']:
        keys.append(f"forecast_v4_{date_str}_{mt}_{college_pk}")
    return keys


def _clear_forecast_cache(date_str: str, college_pk: int) -> None:
    for key in _forecast_cache_keys(date_str, college_pk):
        cache.delete(key)


@pytest.mark.django_db
def test_forecast_excludes_overlap_duration():
    """
    Meal forecast is college-scoped via request.user.college_id. Users and gate passes
    must share that college so counts match compute_dining_forecast.
    """
    college = College.objects.create(name="Forecast Test College", code="FTC")
    chef = User.objects.create_user(
        username="chef_tester",
        email="chef_tester@example.com",
        password="pass12345",
        registration_number="CHEF_FT001",
        role="chef",
        college=college,
        is_active=True,
    )
    client = APIClient()
    client.force_authenticate(user=chef)

    test_date_str = "2026-03-15"
    dt = datetime.strptime(test_date_str, "%Y-%m-%d")
    cid = college.pk

    _clear_forecast_cache(test_date_str, cid)

    # ── Scenario 1: No students in this college ───────────────────────────────
    response = client.get(f"/api/meals/forecast/?meal_type=lunch&date={test_date_str}")
    assert response.status_code == 200, f"Non-200: {response.status_code}"

    for key in [
        "date",
        "meal_type",
        "total_students",
        "excluded_gatepass",
        "excluded_leave",
        "excluded_absent",
        "total_excluded_unique",
        "forecasted_diners",
        "calculation_model",
    ]:
        assert key in response.data, f"Missing key '{key}' in: {list(response.data.keys())}"

    assert response.data["total_students"] == 0
    assert response.data["forecasted_diners"] == 0
    assert response.data["calculation_model"] == "service_v4_precise"

    # ── Scenario 2: One student with approved day gate pass overlapping the day ─
    student = User.objects.create_user(
        username="student_test1",
        email="student1@example.com",
        password="pass12345",
        registration_number="STU_FT001",
        role="student",
        college=college,
        is_active=True,
    )
    exit_date = timezone.make_aware(dt.replace(hour=12, minute=0))
    entry_date = timezone.make_aware(dt.replace(hour=14, minute=0))
    GatePass.objects.create(
        student=student,
        status="approved",
        exit_date=exit_date,
        entry_date=entry_date,
        pass_type="day",
        reason="Test overlap",
        destination="City",
    )

    _clear_forecast_cache(test_date_str, cid)

    response = client.get(f"/api/meals/forecast/?meal_type=lunch&date={test_date_str}")
    assert response.status_code == 200
    assert response.data["total_students"] == 1
    assert response.data["excluded_gatepass"] == 1
    assert response.data["forecasted_diners"] == 0

    # ── Scenario 3: Second student without gate pass ─────────────────────────
    User.objects.create_user(
        username="student_test2",
        email="student2@example.com",
        password="pass12345",
        registration_number="STU_FT002",
        role="student",
        college=college,
        is_active=True,
    )

    _clear_forecast_cache(test_date_str, cid)

    response = client.get(f"/api/meals/forecast/?meal_type=lunch&date={test_date_str}")
    assert response.status_code == 200
    assert response.data["total_students"] == 2
    assert response.data["excluded_gatepass"] == 1
    assert response.data["forecasted_diners"] == 1
