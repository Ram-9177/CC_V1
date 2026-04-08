
import os
import django
import sys

# Setup Django Context
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from apps.colleges.models import College

def update_college():
    try:
        # Try to find the CMR one and rename it
        college = College.objects.filter(code='CMR').first()
        if college:
            college.code = 'SMG'
            college.name = 'St. Marys Group of Institutions'
            college.save()
            print("Successfully updated CMR to SMG (St. Marys Group of Institutions)")
            return
        
        # If no CMR, ensure SMG exists
        college, created = College.objects.get_or_create(
            code='SMG',
            defaults={
                'name': 'St. Marys Group of Institutions',
                'city': 'Hyderabad',
                'state': 'Telangana',
                'is_active': True,
            }
        )
        if created:
            print("Created SMG College (St. Marys Group of Institutions).")
        else:
            college.name = 'St. Marys Group of Institutions'
            college.save()
            print("SMG College already exists, ensured name is correct.")
            
    except Exception as e:
        print(f"Error updating college: {e}")

if __name__ == "__main__":
    update_college()
