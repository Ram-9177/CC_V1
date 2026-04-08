
import os
import django
import sys

# Setup Django Context
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from apps.auth.models import User
from apps.colleges.models import College
from django.contrib.auth.hashers import make_password

def reseed():
    print("🧹 Cleaning existing test data...")
    # Delete test users if they exist, to avoid unique conflicts
    # We identify test users by their email domain @campuscore.test or @example.com
    User.objects.filter(email__endswith='@campuscore.test').delete()
    User.objects.filter(email__endswith='@example.com').delete()
    
    print("🏫 Ensuring St. Marys Group exists...")
    college, _ = College.objects.update_or_create(
        code='SMG',
        defaults={
            'name': 'St. Marys Group of Institutions',
            'city': 'Hyderabad',
            'state': 'Telangana',
            'is_active': True,
        }
    )
    
    # Run management commands
    from django.core.management import call_command
    
    print("🔑 Seeding RBAC...")
    call_command('seed_rbac')
    
    print("📦 Seeding College Modules...")
    call_command('seed_college_modules', college='SMG')
    
    print("👥 Seeding Test Users...")
    call_command('seed_test_users', college_code='SMG')
    
    print("✨ Reseed Complete!")

if __name__ == "__main__":
    reseed()
