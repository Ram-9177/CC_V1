import os
import django
import sys

sys.path.append('/Users/ram/Desktop/SMG-Hostel/backend_django')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_django.core.settings')
django.setup()

from apps.auth.models import User

users = User.objects.all().order_by('role')
roles = {}
for u in users:
    roles.setdefault(u.role, []).append((u.username, u.registration_number, u.get_full_name()))

for role, users_in_role in roles.items():
    print(f'\n--- {role.upper()} ---')
    for u in users_in_role[:10]: # Print up to 10 users per role
        username = u[0]
        reg_no = u[1] or 'N/A'
        name = u[2] or 'No Name'
        print(f'Username/Hall Ticket: {username} | Reg No: {reg_no} | Name: {name}')

