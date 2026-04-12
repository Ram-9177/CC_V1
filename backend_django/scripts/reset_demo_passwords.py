import os
import django
import sys

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# List of users to reset
users_to_reset = [
    'ADMIN_USER', 
    'CHEF_USER', 
    'GATESECURITY', 
    'HEADWARDEN', 
    'SECURITYHEAD', 
    'STAFF_USER', 
    'SUPERADMIN', 
    'WARDEN_USER', 
    '2024TEST001'
]

print(f"{'Username':<20} | {'Role':<20} | {'New Password':<20}")
print("-" * 65)

for username in users_to_reset:
    try:
        user = User.objects.get(username=username)
        user.set_password('password123')
        user.save()
        role = getattr(user, 'role', 'N/A')
        print(f"{username:<20} | {role:<20} | {'password123':<20}")
    except User.DoesNotExist:
        print(f"{username:<20} | {'NOT FOUND':<20} | {'-'}")

# Also fix the 'ADMIN' user role if it exists
try:
    admin_user = User.objects.get(username='ADMIN')
    if admin_user.role == 'student' and admin_user.is_superuser:
        admin_user.role = 'super_admin'
        admin_user.save()
        print(f"{'ADMIN':<20} | {'super_admin (UPD)':<20} | {'password123':<20}")
except User.DoesNotExist:
    pass
