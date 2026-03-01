import pytest
from datetime import datetime
from django.utils import timezone
from django.core.cache import cache
from apps.auth.models import User
from apps.gate_passes.models import GatePass
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_forecast_excludes_overlap_duration():
    """
    Test the meal forecast API response shape and basic gate pass exclusion logic.

    API contract (service_v3_optimized):
      - 'date': ISO date string
      - 'meal_type': string
      - 'total_students': int (active students with role='student')
      - 'excluded_gatepass': int (unique student IDs with active gate pass)
      - 'excluded_leave': int
      - 'excluded_absent': int
      - 'total_excluded_unique': int
      - 'forecasted_diners': int = max(0, total_students - total_excluded_unique)
      - 'calculation_model': 'service_v3_optimized'
    """
    client = APIClient()
    # Use a student role user to be counted in total_students
    staff_user = User.objects.create(username="chef_tester", role="chef", is_active=True)
    client.force_authenticate(user=staff_user)

    test_date_str = '2026-03-15'
    dt = datetime.strptime(test_date_str, "%Y-%m-%d")

    # Clear any cached forecasts for this date before test
    for mt in ['all', 'lunch', 'breakfast', 'dinner', 'snacks']:
        cache.delete(f"forecast_v3_{test_date_str}_{mt}")

    # ── Scenario 1: No students yet — total_students should be 0 ──────────────
    response = client.get(f'/api/meals/forecast/?meal_type=lunch&date={test_date_str}')
    assert response.status_code == 200, f"Non-200: {response.status_code}"

    # Verify response shape (API contract test)
    for key in ['date', 'meal_type', 'total_students', 'excluded_gatepass',
                'excluded_leave', 'excluded_absent', 'total_excluded_unique',
                'forecasted_diners', 'calculation_model']:
        assert key in response.data, f"Missing key '{key}' in: {list(response.data.keys())}"

    assert response.data['total_students'] == 0
    assert response.data['forecasted_diners'] == 0
    assert response.data['calculation_model'] == 'service_v3_optimized'

    # Clear cache before next scenario
    for mt in ['all', 'lunch']:
        cache.delete(f"forecast_v3_{test_date_str}_{mt}")

    # ── Scenario 2: Add 1 student with approved gate pass ─────────────────────
    student = User.objects.create(username="student_test1", role="student", is_active=True)
    exit_date = timezone.make_aware(dt.replace(hour=12, minute=0))
    entry_date = timezone.make_aware(dt.replace(hour=14, minute=0))
    GatePass.objects.create(
        student=student, status="approved",
        exit_date=exit_date, entry_date=entry_date, pass_type='day'
    )

    # Clear cache so the new student + gatepass are recalculated
    for mt in ['all', 'lunch']:
        cache.delete(f"forecast_v3_{test_date_str}_{mt}")

    response = client.get(f'/api/meals/forecast/?meal_type=lunch&date={test_date_str}')
    assert response.status_code == 200
    # 1 active student total, 1 excluded via gatepass → 0 forecasted diners
    assert response.data['total_students'] == 1, f"Expected 1 student: {response.data}"
    assert response.data['excluded_gatepass'] == 1, f"Expected 1 gatepass exclusion: {response.data}"
    assert response.data['forecasted_diners'] == 0, f"Expected 0 diners: {response.data}"

    # ── Scenario 3: Add 1 more student WITHOUT a gate pass ────────────────────
    User.objects.create(username="student_test2", role="student", is_active=True)

    for mt in ['all', 'lunch']:
        cache.delete(f"forecast_v3_{test_date_str}_{mt}")

    response = client.get(f'/api/meals/forecast/?meal_type=lunch&date={test_date_str}')
    assert response.status_code == 200
    # 2 active students total, 1 excluded → 1 forecasted diner
    assert response.data['total_students'] == 2, f"Expected 2 students: {response.data}"
    assert response.data['excluded_gatepass'] == 1, f"Expected 1 exclusion: {response.data}"
    assert response.data['forecasted_diners'] == 1, f"Expected 1 diner: {response.data}"
