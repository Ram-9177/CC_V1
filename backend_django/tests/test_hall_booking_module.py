from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from apps.auth.models import User
from apps.hall_booking.models import Hall


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        username='hall_admin',
        email='hall_admin@example.com',
        password='admin123',
        registration_number='HALLADM001',
        role='admin',
    )


@pytest.fixture
def principal_user(db):
    return User.objects.create_user(
        username='hall_principal',
        email='hall_principal@example.com',
        password='principal123',
        registration_number='HALLPRN001',
        role='principal',
    )


@pytest.fixture
def hod_user(db):
    return User.objects.create_user(
        username='hall_hod',
        email='hall_hod@example.com',
        password='hod123',
        registration_number='HALLHOD001',
        role='hod',
        department='CSE',
    )


@pytest.fixture
def student_user(db):
    return User.objects.create_user(
        username='hall_student',
        email='hall_student@example.com',
        password='student123',
        registration_number='HALLSTU001',
        role='student',
    )


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def principal_client(principal_user):
    client = APIClient()
    client.force_authenticate(user=principal_user)
    return client


@pytest.fixture
def hod_client(hod_user):
    client = APIClient()
    client.force_authenticate(user=hod_user)
    return client


@pytest.fixture
def student_client(student_user):
    client = APIClient()
    client.force_authenticate(user=student_user)
    return client


@pytest.mark.django_db
class TestHallBookingRolesAndFlow:
    def test_student_cannot_create_hall_booking(self, admin_client, student_client):
        hall = Hall.objects.create(
            hall_id='AUD-001',
            hall_name='Main Auditorium',
            capacity=800,
            location='Block A',
            facilities='Projector, Sound System',
        )
        booking_date = (date.today() + timedelta(days=2)).isoformat()

        response = student_client.post(
            '/api/hall-booking/bookings/',
            {
                'hall': hall.id,
                'booking_date': booking_date,
                'start_time': '09:00:00',
                'end_time': '11:00:00',
                'event_name': 'Student Event',
            },
            format='json',
        )

        assert response.status_code == 403

    def test_hod_request_then_principal_approval(self, admin_client, hod_client, principal_client):
        hall_resp = admin_client.post(
            '/api/hall-booking/halls/',
            {
                'hall_id': 'AUD-002',
                'hall_name': 'Seminar Hall A',
                'capacity': 200,
                'location': 'Block B',
                'facilities': 'Projector',
                'status': 'open',
            },
            format='json',
        )
        assert hall_resp.status_code == 201
        hall_id = hall_resp.json()['id']

        slot_resp = admin_client.post(
            '/api/hall-booking/slots/',
            {
                'hall': hall_id,
                'start_time': '09:00:00',
                'end_time': '11:00:00',
                'status': 'open',
                'is_active': True,
            },
            format='json',
        )
        assert slot_resp.status_code == 201
        slot_id = slot_resp.json()['id']

        booking_date = (date.today() + timedelta(days=1)).isoformat()

        request_resp = hod_client.post(
            '/api/hall-booking/bookings/',
            {
                'hall': hall_id,
                'slot': slot_id,
                'booking_date': booking_date,
                'start_time': '09:00:00',
                'end_time': '11:00:00',
                'event_name': 'Department Orientation',
                'department': 'CSE',
                'expected_participants': 120,
                'description': 'Orientation for first years',
            },
            format='json',
        )
        assert request_resp.status_code == 201, request_resp.json()
        booking_id = request_resp.json()['id']

        approve_resp = principal_client.post(
            f'/api/hall-booking/bookings/{booking_id}/approve/',
            {'review_note': 'Approved for schedule'},
            format='json',
        )
        assert approve_resp.status_code == 200
        assert approve_resp.json()['status'] == 'approved'

    def test_overlapping_pending_requests_are_blocked(self, admin_client, hod_client):
        hall_resp = admin_client.post(
            '/api/hall-booking/halls/',
            {
                'hall_id': 'AUD-003',
                'hall_name': 'Conference Room',
                'capacity': 80,
                'location': 'Admin Block',
                'facilities': 'Mic',
                'status': 'open',
            },
            format='json',
        )
        assert hall_resp.status_code == 201
        hall_id = hall_resp.json()['id']

        booking_date = (date.today() + timedelta(days=3)).isoformat()

        first = hod_client.post(
            '/api/hall-booking/bookings/',
            {
                'hall': hall_id,
                'booking_date': booking_date,
                'start_time': '11:00:00',
                'end_time': '13:00:00',
                'event_name': 'Faculty Meet',
                'department': 'ECE',
            },
            format='json',
        )
        assert first.status_code == 201

        second = hod_client.post(
            '/api/hall-booking/bookings/',
            {
                'hall': hall_id,
                'booking_date': booking_date,
                'start_time': '12:00:00',
                'end_time': '14:00:00',
                'event_name': 'Another Event',
                'department': 'EEE',
            },
            format='json',
        )
        assert second.status_code == 400
