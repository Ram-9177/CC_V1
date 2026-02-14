import os
import django
import sys

# Setup Django
sys.path.append(os.path.join(os.getcwd(), 'backend_django'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from apps.auth.models import User

# Standard demo users and their roles
USERS_TO_RESET = [
    ('ADMIN', 'super_admin'),
    ('WARDEN', 'warden'),
    ('HEADWARDEN', 'head_warden'),
    ('SECURITY', 'gate_security'),
    ('SECURITYHEAD', 'security_head'),
    ('CHEF', 'chef'),
    ('STUDENT1', 'student'),
    ('STUDENT2', 'student'),
]

NEW_PASSWORD = 'password123'

print(f"{'Username':<15} | {'Role':<15} | {'Password':<15}")
print("-" * 50)

for username, role in USERS_TO_RESET:
    try:
        user = User.objects.get(username=username)
        user.set_password(NEW_PASSWORD)
        user.is_password_changed = True # Bypass the mandatory change for demo
        user.is_active = True
        user.save()
        print(f"{username:<15} | {role:<15} | {NEW_PASSWORD:<15}")
    except User.DoesNotExist:
        # Create if doesn't exist for demo
        user = User.objects.create_user(
            username=username,
            email=f"{username.lower()}@example.com",
            password=NEW_PASSWORD,
            role=role,
            is_password_changed=True,
            is_active=True
        )
        print(f"{username:<15}* | {role:<15} | {NEW_PASSWORD:<15} (Created)")

print("\n* Created new user if they didn't exist.")
