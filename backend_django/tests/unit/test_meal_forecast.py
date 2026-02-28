import pytest
from datetime import datetime
from django.utils import timezone
from apps.auth.models import User
from apps.gate_passes.models import GatePass
from rest_framework.test import APIClient

@pytest.mark.django_db
def test_forecast_excludes_overlap_duration():
    client = APIClient()
    student = User.objects.create(username="student1", role="chef", is_active=True)
    client.force_authenticate(user=student)
    
    # Use fixed date to prevent timezone/time test flakiness
    test_date_str = '2026-03-01'
    dt = datetime.strptime(test_date_str, "%Y-%m-%d")
    
    # Lunch window is 12:30 -> 14:30 (120 min)
    # Scenario 1: 50 min overlap, 13:40 -> 15:00
    exit_date = timezone.make_aware(dt.replace(hour=13, minute=40))
    entry_date = timezone.make_aware(dt.replace(hour=15, minute=0))
    GatePass.objects.create(student=student, status="approved", exit_date=exit_date, entry_date=entry_date, pass_type='day')
    
    response = client.get(f'/api/meals/forecast/?meal_type=lunch&date={test_date_str}')
    assert response.data['excluded_gatepass_students'] == 0, f"Error1: {response.data}"
    
    # Scenario 2: 90 min overlap, 12:00 -> 14:00
    student2 = User.objects.create(username="student2", role="student", is_active=True)
    exit_date2 = timezone.make_aware(dt.replace(hour=12, minute=0))
    entry_date2 = timezone.make_aware(dt.replace(hour=14, minute=0))
    GatePass.objects.create(student=student2, status="approved", exit_date=exit_date2, entry_date=entry_date2, pass_type='day')

    from django.core.cache import cache
    cache.delete(f"meal_forecast_{test_date_str}_lunch")

    response = client.get(f'/api/meals/forecast/?meal_type=lunch&date={test_date_str}')
    assert response.data['excluded_gatepass_students'] == 1, f"Error2: {response.data}"
