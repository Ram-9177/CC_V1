import os
import sys
import django
from pathlib import Path

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.test')
django.setup()

from django.contrib.auth import get_user_model
from apps.auth.serializers import AdminUserCreateSerializer
from core.constants import UserRoles
import traceback

User = get_user_model()

def test_superadmin_creation():
    """Test creating a SuperAdmin user with AdminUserCreateSerializer."""
    
    print("=" * 70)
    print("Testing SuperAdmin Creation with AdminUserCreateSerializer")
    print("=" * 70)
    
    # Prepare test data for SuperAdmin
    test_data = {
        'username': 'test_superadmin_001',
        'email': 'test_superadmin@example.com',
        'password': 'TestPassword123',
        'password_confirm': 'TestPassword123',
        'first_name': 'Test',
        'last_name': 'SuperAdmin',
        'phone_number': '9876543210',
        'role': UserRoles.SUPER_ADMIN,
        # Optional fields
        'is_active': True,
        'is_approved': True,
    }
    
    from django.test import RequestFactory
    from django.contrib.auth.models import AnonymousUser
    
    factory = RequestFactory()
    request = factory.post('/')
    
    # Create a SuperAdmin user manually first for the request context
    super_admin_user, _ = User.objects.get_or_create(
        username='sa_context_user_xyz',
        email='sa_context_xyz@example.com',
    )
    super_admin_user.set_password('TempPass123')
    super_admin_user.role = UserRoles.SUPER_ADMIN
    super_admin_user.is_superuser = True
    super_admin_user.save()
    request.user = super_admin_user

    serializer = AdminUserCreateSerializer(
        data=test_data,
        context={'request': request}
    )
    
    is_valid = serializer.is_valid()
    print(f"Valid: {is_valid}")
    if not is_valid:
        for field, errors in serializer.errors.items():
            print(f"  - {field}: {errors}")
        return
    
    try:
        created_user = serializer.save()
        print(f"✓ User created successfully: {created_user}")
        print(f"  - Username: {created_user.username}")
        print(f"  - Role: {created_user.role}")
        print(f"  - is_superuser: {created_user.is_superuser}")
        
    except Exception as e:
        print(f"✗ User creation failed: {e}")
        traceback.print_exc()

if __name__ == '__main__':
    User.objects.filter(username__startswith='test_superadmin').delete()
    test_superadmin_creation()
