from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def pt_user(user_factory):
    return user_factory(username='PTSPORT1', registration_number='PTSPORT1', role='pt')


@pytest.fixture
def pd_user(user_factory):
    return user_factory(username='PDSPORT1', registration_number='PDSPORT1', role='pd')


@pytest.fixture
def student_user(user_factory):
    return user_factory(username='STUSPORT1', registration_number='STUSPORT1', role='student')


@pytest.fixture
def pt_client(pt_user):
    client = APIClient()
    client.force_authenticate(user=pt_user)
    return client


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.mark.django_db
class TestSportsManagementPermissions:
    def test_pt_can_create_sport_court_and_slot(self, pt_client):
        sport_response = pt_client.post(
            '/api/sports/sports/',
            {
                'name': 'Basketball',
                'min_players': 5,
                'max_players': 10,
                'game_type': 'team',
                'status': 'active',
            },
            format='json',
        )
        assert sport_response.status_code == 201, sport_response.json()
        sport_id = sport_response.json()['id']

        court_response = pt_client.post(
            '/api/sports/courts/',
            {
                'name': 'Main Basketball Court',
                'sport': sport_id,
                'location': 'Outdoor Block',
                'capacity': 10,
                'status': 'open',
            },
            format='json',
        )
        assert court_response.status_code == 201, court_response.json()
        court_id = court_response.json()['id']

        slot_response = pt_client.post(
            '/api/sports/slots/',
            {
                'court': court_id,
                'date': (date.today() + timedelta(days=1)).isoformat(),
                'start_time': '07:00:00',
                'end_time': '08:00:00',
                'max_players': 10,
            },
            format='json',
        )
        assert slot_response.status_code == 201, slot_response.json()

    def test_pt_can_open_management_dashboard_stats(self, pt_client):
        response = pt_client.get('/api/sports/dept-requests/pd-dashboard/')

        assert response.status_code == 200, response.json()
        payload = response.json()
        assert 'bookings_today' in payload
        assert 'pending_requests' in payload

    def test_student_cannot_create_sport(self, student_client):
        response = student_client.post(
            '/api/sports/sports/',
            {
                'name': 'Unauthorized Sport',
                'min_players': 1,
                'max_players': 2,
                'game_type': 'singles',
                'status': 'active',
            },
            format='json',
        )

        assert response.status_code == 403