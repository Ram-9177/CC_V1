from __future__ import annotations

import pytest


@pytest.mark.django_db
def test_events_register_missing_event_id_returns_400_not_500(admin_api_client):
    response = admin_api_client.post('/api/events/registrations/register/', {}, format='json')

    assert response.status_code == 400
    payload = response.json()
    assert payload.get('success') is False
    assert payload.get('code') == 'API_ERROR'


@pytest.mark.django_db
def test_attendance_today_empty_state_returns_200(authenticated_api_client):
    response = authenticated_api_client.get('/api/attendance/today/')

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, dict)
    assert payload.get('detail') == 'No attendance record for today.'
