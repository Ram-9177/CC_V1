
import os
import django
import sys
from django.core.files import File

# Setup Django Context
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from apps.colleges.models import College
from apps.auth.models import User

def sync_branding():
    # 1. Create/Update the SMG College
    college, created = College.objects.update_or_create(
        code='SMG',
        defaults={
            'name': 'St. Marys Group of Institutions',
            'city': 'Hyderabad',
            'state': 'Telangana',
            'is_active': True,
            'primary_color': '#FF6B00', # Institutional Orange
        }
    )
    
    status = "Created" if created else "Updated"
    print(f"{status} College: {college.name} (Code: {college.code})")

    # 2. Assign all test users to this college
    updated_users = User.objects.all().update(college=college)
    print(f"Linked {updated_users} users to {college.code}.")

    # 3. Handle Logo (Optional: If you want to test the swap)
    # To test the college-specific logo, you would upload a file to college.logo
    # For now, we leave it blank so it falls back to the Project Logo (/Logo.png)
    # as per your logic.

if __name__ == "__main__":
    sync_branding()
