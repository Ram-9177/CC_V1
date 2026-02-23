"""Comprehensive Test Suite for Authentication App
Tests all auth endpoints and serializers
"""

import pytest
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from apps.auth.serializers import LoginSerializer

User = get_user_model()


@pytest.mark.django_db
class TestAuthentication:
    """Test authentication endpoints."""
    
    def setup_method(self):
        """Set up test client."""
        self.client = APIClient()
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'testpass123',
            'first_name': 'Test',
            'last_name': 'User',
            'role': 'student',
            'registration_number': 'REG001'
        }
    
    def test_user_registration(self):
        """Test user registration."""
        data = {
            **self.user_data,
            'password_confirm': self.user_data['password']
        }
        
        response = self.client.post('/api/auth/register/', data)
        assert response.status_code == status.HTTP_201_CREATED
        assert 'access' in response.data or 'tokens' in response.data
        assert User.objects.count() == 1
    
    def test_user_login_success(self):
        """Test successful user login."""
        # Create user
        User.objects.create_user(**self.user_data)
        
        # Login
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data or 'tokens' in response.data
    
    def test_user_login_invalid_credentials(self):
        """Test login with invalid credentials."""
        User.objects.create_user(**self.user_data)
        
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'wrongpassword'
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_login_missing_fields(self):
        """Test login with missing required fields."""
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser'
        })
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
    
    def test_token_refresh(self):
        """Test token refresh endpoint."""
        user = User.objects.create_user(**self.user_data)
        refresh = RefreshToken.for_user(user)
        
        response = self.client.post('/api/auth/refresh/', {
            'refresh': str(refresh)
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
    
    def test_protected_endpoint_without_token(self):
        """Test accessing protected endpoint without token."""
        response = self.client.get('/api/users/')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_protected_endpoint_with_token(self):
        """Test accessing protected endpoint with valid token."""
        user = User.objects.create_user(**self.user_data)
        refresh = RefreshToken.for_user(user)
        access_token = refresh.access_token
        
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        response = self.client.get('/api/users/')
        
        assert response.status_code == status.HTTP_200_OK
    
    def test_registration_duplicate_username(self):
        """Test registration with duplicate username."""
        User.objects.create_user(**self.user_data)
        
        data = {
            **self.user_data,
            'email': 'different@example.com',
            'password_confirm': self.user_data['password']
        }
        
        response = self.client.post('/api/auth/register/', data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class LoginSerializerTestCase(TestCase):
    """Test login serializer"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123',
            role='student'
        )

    def test_valid_credentials(self):
        """Test serializer with valid credentials"""
        serializer = LoginSerializer(data={
            'username': 'testuser',
            'password': 'testpass123'
        })

        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['user'].username, 'TESTUSER')

    def test_invalid_credentials(self):
        """Test serializer with invalid credentials"""
        serializer = LoginSerializer(data={
            'username': 'testuser',
            'password': 'wrongpassword'
        })
        from rest_framework.exceptions import AuthenticationFailed
        with self.assertRaises(AuthenticationFailed):
            serializer.is_valid()
