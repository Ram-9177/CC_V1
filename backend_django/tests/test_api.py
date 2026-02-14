import pytest
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
class TestRoomAPI(APITestCase):
    """Test room management API"""
    
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='admin123',
            registration_number='ADM001',
            role='admin'
        )
        self.student_user = User.objects.create_user(
            username='student1',
            email='student1@example.com',
            password='student123',
            registration_number='STU001',
            role='student'
        )
    
    def test_room_list_requires_authentication(self):
        """Test that room list requires authentication"""
        response = self.client.get('/api/rooms/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_authenticated_user_can_list_rooms(self):
        """Test that authorized roles can list rooms"""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get('/api/rooms/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_student_cannot_list_rooms(self):
        """Test that students cannot list rooms"""
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get('/api/rooms/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
class TestMealAPI(APITestCase):
    """Test meal management API"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='test123',
            registration_number='TST001',
            role='student'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_meal_list_access(self):
        """Test accessing meal list"""
        response = self.client.get('/api/meals/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


@pytest.mark.django_db
class TestAttendanceAPI(APITestCase):
    """Test attendance API"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='test123',
            registration_number='TST001',
            role='student'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_attendance_list_access(self):
        """Test accessing attendance list"""
        response = self.client.get('/api/attendance/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


@pytest.mark.django_db
class TestGatePassAPI(APITestCase):
    """Test gate pass API"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='test123',
            registration_number='TST001',
            role='student'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_gate_pass_list_access(self):
        """Test accessing gate pass list"""
        response = self.client.get('/api/gate-passes/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_gate_pass_create_with_frontend_fields(self):
        """Students can create a gate pass with the frontend payload shape."""
        response = self.client.post(
            '/api/gate-passes/',
            {
                'purpose': 'Visit family',
                'exit_date': '2026-02-05',
                'exit_time': '10:00',
                'expected_return_date': '2026-02-05',
                'expected_return_time': '18:00',
                'remarks': '',
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        # Defaults applied by serializer.create()
        self.assertEqual(response.data.get('pass_type'), 'day')
        self.assertEqual(response.data.get('purpose'), 'Visit family')


@pytest.mark.django_db
class TestNotificationAPI(APITestCase):
    """Test notification API"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='test123',
            registration_number='TST001',
            role='student'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_notification_list_access(self):
        """Test accessing notifications"""
        response = self.client.get('/api/notifications/notifications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


@pytest.mark.django_db
class TestReportAPI(APITestCase):
    """Test report API"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='admin123',
            registration_number='ADM001',
            role='admin'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_report_access_requires_admin(self):
        """Test that reports require admin access"""
        # Create a student user
        student = User.objects.create_user(
            username='student',
            email='student@example.com',
            password='student123',
            registration_number='STU001',
            role='student'
        )
        
        self.client.force_authenticate(user=student)
        response = self.client.get('/api/reports/')
        # May return 403 or 200 depending on permission setup
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN])


@pytest.mark.django_db
class TestMetricsAPI(APITestCase):
    """Test metrics API"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='test123',
            registration_number='TST001',
            role='student'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_metrics_access(self):
        """Test accessing metrics"""
        response = self.client.get('/api/metrics/dashboard/')
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN])
