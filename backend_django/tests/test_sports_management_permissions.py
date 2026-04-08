from datetime import date, timedelta

import pytest
from rest_framework.test import APIClient

from apps.colleges.models import College
from apps.sports.models import Sport, SportSlotBooking


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

    def test_pt_cannot_create_overlapping_slot_on_same_court(self, pt_client):
        sport_response = pt_client.post(
            '/api/sports/sports/',
            {
                'name': 'Badminton',
                'min_players': 2,
                'max_players': 4,
                'game_type': 'doubles',
                'status': 'active',
            },
            format='json',
        )
        assert sport_response.status_code == 201, sport_response.json()

        court_response = pt_client.post(
            '/api/sports/courts/',
            {
                'name': 'Court Overlap Test',
                'sport': sport_response.json()['id'],
                'location': 'Block A',
                'capacity': 8,
                'status': 'open',
            },
            format='json',
        )
        assert court_response.status_code == 201, court_response.json()
        court_id = court_response.json()['id']

        slot_date = (date.today() + timedelta(days=2)).isoformat()
        first_slot = pt_client.post(
            '/api/sports/slots/',
            {
                'court': court_id,
                'date': slot_date,
                'start_time': '09:00:00',
                'end_time': '10:00:00',
                'max_players': 8,
            },
            format='json',
        )
        assert first_slot.status_code == 201, first_slot.json()

        overlapping_slot = pt_client.post(
            '/api/sports/slots/',
            {
                'court': court_id,
                'date': slot_date,
                'start_time': '09:30:00',
                'end_time': '10:30:00',
                'max_players': 8,
            },
            format='json',
        )

        assert overlapping_slot.status_code == 400, overlapping_slot.json()

    def test_pt_cannot_create_court_for_other_college_sport(self, pt_client, pt_user):
        college_a = College.objects.create(
            name='Scope Test College A',
            code='SCOPE_A',
            city='CityA',
            state='StateA',
        )
        college_b = College.objects.create(
            name='Scope Test College B',
            code='SCOPE_B',
            city='CityB',
            state='StateB',
        )

        pt_user.college = college_a
        pt_user.save(update_fields=['college'])

        foreign_sport = Sport.objects.create(
            name='Foreign College Sport',
            min_players=2,
            max_players=10,
            game_type='team',
            status='active',
            college=college_b,
        )

        response = pt_client.post(
            '/api/sports/courts/',
            {
                'name': 'Invalid Cross College Court',
                'sport': foreign_sport.id,
                'location': 'Unauthorized',
                'capacity': 10,
                'status': 'open',
            },
            format='json',
        )

        assert response.status_code == 403, response.json()

    def test_pt_can_complete_department_request_after_approval(self, pt_client, pt_user):
        college = College.objects.create(
            name='Complete Flow College',
            code='COMPLETE_C1',
            city='CityC',
            state='StateC',
        )
        pt_user.college = college
        pt_user.save(update_fields=['college'])

        sport_response = pt_client.post(
            '/api/sports/sports/',
            {
                'name': 'Volleyball',
                'min_players': 6,
                'max_players': 12,
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
                'name': 'Volleyball Main Court',
                'sport': sport_id,
                'location': 'Sports Complex',
                'capacity': 16,
                'status': 'open',
            },
            format='json',
        )
        assert court_response.status_code == 201, court_response.json()
        court_id = court_response.json()['id']

        request_response = pt_client.post(
            '/api/sports/dept-requests/',
            {
                'title': 'CSE Inter-Class Match',
                'sport': sport_id,
                'requested_date': (date.today() + timedelta(days=3)).isoformat(),
                'requested_start_time': '10:00:00',
                'requested_end_time': '11:00:00',
                'department': 'CSE',
                'year_of_study': 2,
                'estimated_players': 10,
                'notes': 'Practice match',
            },
            format='json',
        )
        assert request_response.status_code == 201, request_response.json()
        request_id = request_response.json()['id']

        approve_response = pt_client.post(
            f'/api/sports/dept-requests/{request_id}/approve/',
            {'court_id': court_id},
            format='json',
        )
        assert approve_response.status_code == 200, approve_response.json()
        assert approve_response.json()['status'] == 'approved'

        complete_response = pt_client.post(
            f'/api/sports/dept-requests/{request_id}/complete/',
            {},
            format='json',
        )
        assert complete_response.status_code == 200, complete_response.json()
        assert complete_response.json()['status'] == 'completed'

    def test_student_cannot_create_equipment(self, student_client):
        response = student_client.post(
            '/api/sports/equipment/',
            {
                'sport': 99999,
                'name': 'Restricted Equipment',
                'total_quantity': 4,
            },
            format='json',
        )

        assert response.status_code == 403, response.json()

    def test_pt_can_issue_and_return_equipment(self, pt_client, pt_user, student_user):
        college = College.objects.create(
            name='Equipment Flow College',
            code='EQUIP_C1',
            city='CityE',
            state='StateE',
        )
        pt_user.college = college
        pt_user.save(update_fields=['college'])
        student_user.college = college
        student_user.save(update_fields=['college'])

        sport_response = pt_client.post(
            '/api/sports/sports/',
            {
                'name': 'Table Tennis',
                'min_players': 2,
                'max_players': 4,
                'game_type': 'doubles',
                'status': 'active',
            },
            format='json',
        )
        assert sport_response.status_code == 201, sport_response.json()

        equipment_response = pt_client.post(
            '/api/sports/equipment/',
            {
                'sport': sport_response.json()['id'],
                'name': 'TT Rackets',
                'category': 'Rackets',
                'total_quantity': 12,
                'low_stock_threshold': 2,
                'status': 'available',
                'storage_location': 'Sports Office',
            },
            format='json',
        )
        assert equipment_response.status_code == 201, equipment_response.json()
        equipment_id = equipment_response.json()['id']

        issue_response = pt_client.post(
            '/api/sports/equipment-issues/',
            {
                'equipment': equipment_id,
                'issued_to_lookup': student_user.registration_number,
                'quantity': 2,
                'notes': 'Practice session issue',
            },
            format='json',
        )
        assert issue_response.status_code == 201, issue_response.json()
        issue_payload = issue_response.json()
        assert issue_payload['status'] == 'issued'
        assert issue_payload['issued_to_details']['registration_number'] == student_user.registration_number

        equipment_detail = pt_client.get(f'/api/sports/equipment/{equipment_id}/')
        assert equipment_detail.status_code == 200, equipment_detail.json()
        assert equipment_detail.json()['issued_quantity'] == 2
        assert equipment_detail.json()['available_quantity'] == 10

        return_response = pt_client.post(
            f"/api/sports/equipment-issues/{issue_payload['id']}/return-item/",
            {},
            format='json',
        )
        assert return_response.status_code == 200, return_response.json()
        assert return_response.json()['status'] == 'returned'

        equipment_detail = pt_client.get(f'/api/sports/equipment/{equipment_id}/')
        assert equipment_detail.status_code == 200, equipment_detail.json()
        assert equipment_detail.json()['issued_quantity'] == 0
        assert equipment_detail.json()['available_quantity'] == 12

    def test_waitlist_booking_promotes_after_cancellation(self, pt_client, pt_user, student_client, student_user, user_factory):
        college = College.objects.create(
            name='Waitlist Flow College',
            code='WAIT_C1',
            city='CityW',
            state='StateW',
        )
        pt_user.college = college
        pt_user.save(update_fields=['college'])
        student_user.college = college
        student_user.save(update_fields=['college'])

        waitlist_user = user_factory(username='STUSPORT2', registration_number='STUSPORT2', role='student')
        waitlist_user.college = college
        waitlist_user.save(update_fields=['college'])

        waitlist_client = APIClient()
        waitlist_client.force_authenticate(user=waitlist_user)

        sport_response = pt_client.post(
            '/api/sports/sports/',
            {
                'name': 'Squash',
                'min_players': 2,
                'max_players': 2,
                'game_type': 'singles',
                'status': 'active',
            },
            format='json',
        )
        assert sport_response.status_code == 201, sport_response.json()
        sport_id = sport_response.json()['id']

        court_response = pt_client.post(
            '/api/sports/courts/',
            {
                'name': 'Squash Court 1',
                'sport': sport_id,
                'location': 'Indoor Arena',
                'capacity': 2,
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
                'start_time': '18:00:00',
                'end_time': '19:00:00',
                'max_players': 1,
            },
            format='json',
        )
        assert slot_response.status_code == 201, slot_response.json()
        slot_id = slot_response.json()['id']

        confirmed_response = student_client.post(
            '/api/sports/bookings/',
            {'slot': slot_id},
            format='json',
        )
        assert confirmed_response.status_code == 201, confirmed_response.json()
        confirmed_booking_id = confirmed_response.json()['id']
        assert confirmed_response.json()['status'] == 'confirmed'

        waitlist_response = waitlist_client.post(
            '/api/sports/bookings/',
            {'slot': slot_id, 'join_waitlist': True},
            format='json',
        )
        assert waitlist_response.status_code == 201, waitlist_response.json()
        waitlist_booking_id = waitlist_response.json()['id']
        assert waitlist_response.json()['status'] == 'waitlisted'
        assert waitlist_response.json()['waitlist_position'] == 1

        slot_detail = waitlist_client.get(f'/api/sports/slots/{slot_id}/')
        assert slot_detail.status_code == 200, slot_detail.json()
        assert slot_detail.json()['waitlist_count'] == 1

        cancel_response = student_client.delete(f'/api/sports/bookings/{confirmed_booking_id}/')
        assert cancel_response.status_code == 204

        promoted_booking = SportSlotBooking.objects.get(id=waitlist_booking_id)
        assert promoted_booking.status == 'confirmed'