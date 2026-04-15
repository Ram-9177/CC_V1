import os
import sys
import django
from pathlib import Path

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.test')
django.setup()

from django.contrib.auth import get_user_model
from apps.auth.serializers import AdminUserCreateSerializer
from apps.colleges.models import College
from core.constants import UserRoles
from apps.users.models import Tenant
import traceback

User = get_user_model()

def test_student_creation():
    
    # Prepare test data for Student
    college, _ = College.objects.get_or_create(code="TEST01", name="Test College", defaults={'max_users': 100})
    test_data = {
        'username': 'test_student_001',
        'email': 'student_test123@example.com',
        'password': 'TestPassword123',
        'password_confirm': 'TestPassword123',
        'first_name': 'Test',
        'last_name': 'Student',
        'phone_number': '9876543210',
        'role': UserRoles.STUDENT,
        'college': college.id,
        'father_name': 'Papa Student',
        # Optional fields
        'is_active': True,
        'is_approved': True,
    }
    
    from django.test import RequestFactory
    factory = RequestFactory()
    request = factory.post('/')
    
    super_admin_user = User.objects.filter(is_superuser=True).first()
    request.user = super_admin_user

    serializer = AdminUserCreateSerializer(
        data=test_data,
        context={'request': request}
    )
    
    is_valid = serializer.is_valid()
    print(f"Valid: {is_valid}")
    if not is_valid:
        print(serializer.errors)
        return
    
    try:
        created_user = serializer.save()
        print(f"✓ User created successfully: {created_user}")
        print(f"  - Username: {created_user.username}")
        # check Tenant
        tenant = Tenant.objects.get(user=created_user)
        print(f"  - Father Name: {tenant.father_name}")
        
    except Exception as e:
        print(f"✗ User creation failed: {e}")
        traceback.print_exc()

if __name__ == '__main__':
    User.objects.filter(username__startswith='test_student').delete()
    test_student_creation()
