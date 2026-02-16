from apps.auth.models import User
from django.contrib.auth import get_user_model

User = get_user_model()

roles = [
    'warden', 'head_warden', 
    'chef', 'head_chef', 
    'gate_security', 'security_head', 
    'student', 'staff'
]

# Ensure at least 3 users per role
for role in roles:
    for i in range(1, 4):  # Creates user1, user2, user3
        # Generate username like WARDEN1, CHEF2
        username = f"{role.upper()}{i}"
        email = f"{role.lower()}{i}@example.com"
        
        if not User.objects.filter(username=username).exists():
            print(f"Creating {username} ({role})...")
            User.objects.create_user(
                username=username,
                email=email,
                password='password123',
                role=role,
                first_name=role.replace('_', ' ').title(),
                last_name=str(i)
            )
        else:
            print(f"Skipping {username} - already exists")

# Create Super Admin if needed
if not User.objects.filter(username='SUPER_ADMIN1').exists():
    print("Creating SUPER_ADMIN1...")
    User.objects.create_superuser(
        username='SUPER_ADMIN1',
        email='superadmin1@example.com',
        password='password123',
        role='super_admin',
        first_name='Super',
        last_name='Admin'
    )
else:
    print("Skipping SUPER_ADMIN1 - already exists")

print("\nDONE: All test users created successfully.")
