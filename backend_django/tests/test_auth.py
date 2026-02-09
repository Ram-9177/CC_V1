import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

@pytest.mark.django_db
class TestUserAuthentication(APITestCase):
    """Test authentication endpoints"""
    
    def setUp(self):
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpass123',
            'registration_number': 'REG001',
            'role': 'student'
        }
        self.user = User.objects.create_user(**self.user_data)
    
    def test_user_creation(self):
        """Test creating a new user"""
        self.assertEqual(User.objects.count(), 1)
        self.assertEqual(self.user.username, 'TESTUSER')
        self.assertEqual(self.user.role, 'student')
    
    def test_user_password_hashing(self):
        """Test that passwords are hashed"""
        self.assertTrue(self.user.check_password('testpass123'))
        self.assertNotEqual(self.user.password, 'testpass123')
    
    def test_login_endpoint(self):
        """Test JWT token generation on login"""
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])
    
    def test_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'wrongpassword'
        })
        
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_token_refresh(self):
        """Test JWT token refresh"""
        # Get initial tokens
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        refresh = response.data['tokens']['refresh']
        
        # Refresh token
        response = self.client.post('/api/token/refresh/', {
            'refresh': refresh
        })
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
    
    def test_protected_endpoint_without_token(self):
        """Test accessing protected endpoint without token"""
        response = self.client.get('/api/users/tenants/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_protected_endpoint_with_token(self):
        """Test accessing protected endpoint with token"""
        # Get token
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        access = response.data['tokens']['access']
        
        # Access protected endpoint
        response = self.client.get(
            '/api/users/tenants/',
            HTTP_AUTHORIZATION=f'Bearer {access}'
        )
        
        # Tenants endpoint is restricted to admin/warden roles.
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
class TestRoomManagement(APITestCase):
    """Test room management endpoints"""
    
    def setUp(self):
        self.user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='admin123',
            registration_number='ADM001',
            role='admin'
        )
        self.client.force_authenticate(user=self.user)
    
    def test_room_list_requires_auth(self):
        """Test room list requires authentication"""
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/rooms/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
    
    def test_room_list_access(self):
        """Test authorized user can list rooms"""
        response = self.client.get('/api/rooms/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


@pytest.mark.django_db
class TestHealthCheck(APITestCase):
    """Test health check endpoint"""
    
    def test_health_endpoint_accessible(self):
        """Test health check endpoint is accessible without auth"""
        response = self.client.get('/api/health/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_health_endpoint_returns_status(self):
        """Test health endpoint returns status information"""
        response = self.client.get('/api/health/')
        data = response.json()
        
        self.assertIn('status', data)
        self.assertEqual(data['status'], 'ok')


@pytest.mark.django_db
class TestCORSConfiguration(APITestCase):
    """Test CORS headers"""
    
    def test_cors_headers_present(self):
        """Test that CORS headers are included"""
        response = self.client.options(
            '/api/health/',
            HTTP_ORIGIN='http://localhost:3000'
        )
        
        # CORS headers should be present
        self.assertIn('Access-Control-Allow-Origin', response)


class TestUserModel(TestCase):
    """Test User model"""
    
    def test_user_creation(self):
        """Test creating a user"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            registration_number='REG001',
            role='student'
        )
        
        self.assertEqual(user.username, 'TESTUSER')
        self.assertEqual(user.email, 'test@example.com')
        self.assertEqual(user.role, 'student')
    
    def test_superuser_creation(self):
        """Test creating a superuser"""
        user = User.objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='admin123'
        )
        
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
    
    def test_user_str_representation(self):
        """Test user string representation"""
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            registration_number='REG001'
        )
        
        self.assertEqual(str(user), 'TESTUSER (REG001)')


class TestDatabaseConnectivity(TestCase):
    """Test database connectivity"""
    
    def test_database_connection(self):
        """Test that database is accessible"""
        # If we can create a user, database is connected
        user = User.objects.create_user(
            username='dbtest',
            email='dbtest@example.com',
            password='testpass123',
            registration_number='DBT001'
        )
        
        self.assertIsNotNone(user.id)
        self.assertTrue(user.id > 0)
