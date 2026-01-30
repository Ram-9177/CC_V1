# conftest.py - Pytest configuration and fixtures

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


@pytest.fixture
def api_client():
    """API client for making requests"""
    return APIClient()


@pytest.fixture
def authenticated_user(db):
    """Create an authenticated student user"""
    user = User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123',
        registration_number='REG001',
        role='student'
    )
    return user


@pytest.fixture
def admin_user(db):
    """Create an admin user"""
    user = User.objects.create_user(
        username='admin',
        email='admin@example.com',
        password='admin123',
        registration_number='ADM001',
        role='admin'
    )
    return user


@pytest.fixture
def authenticated_api_client(api_client, authenticated_user):
    """API client with authenticated user"""
    api_client.force_authenticate(user=authenticated_user)
    return api_client


@pytest.fixture
def admin_api_client(api_client, admin_user):
    """API client with admin user"""
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def jwt_tokens(authenticated_user):
    """Generate JWT tokens for a user"""
    refresh = RefreshToken.for_user(authenticated_user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }
