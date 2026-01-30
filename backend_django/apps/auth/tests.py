"""Tests for authentication."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

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
        assert 'tokens' in response.data
        assert User.objects.count() == 1
    
    def test_user_login(self):
        """Test user login."""
        # Create user
        User.objects.create_user(**self.user_data)
        
        # Login
        response = self.client.post('/api/auth/login/', {
            'username': 'testuser',
            'password': 'testpass123'
        })
        
        assert response.status_code == status.HTTP_200_OK
        assert 'tokens' in response.data
