import os
import django
import sys

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()
users = User.objects.all().order_by('username')


print(f"{'Username':<20} | {'Email':<30} | {'Role':<20} | {'Is Active':<10}")
print("-" * 90)

for user in users:
    # Get role if available, default to 'N/A'
    role = getattr(user, 'role', 'N/A')
    
    # Format active status
    is_active = "Yes" if user.is_active else "No"
    
    print(f"{user.username:<20} | {user.email:<30} | {role:<20} | {is_active:<10}")
