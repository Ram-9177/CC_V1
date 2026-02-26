import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from apps.auth.models import User

# Desired config
roles_counts = {
    'super_admin': ['SUPERADMIN'],
    'admin': ['ADMIN'],
    'warden': ['WARDEN1', 'WARDEN2', 'WARDEN3'],
    'head_warden': ['HEAD_WARDEN1', 'HEAD_WARDEN2', 'HEAD_WARDEN3'],
    'staff': ['STAFF1', 'STAFF2', 'STAFF3'],
    'chef': ['CHEF1', 'CHEF2', 'CHEF3'],
    'head_chef': ['HEAD_CHEF1', 'HEAD_CHEF2', 'HEAD_CHEF3'],
    'gate_security': ['GATE_SECURITY1', 'GATE_SECURITY2', 'GATE_SECURITY3'],
    'security_head': ['SECURITY_HEAD1', 'SECURITY_HEAD2', 'SECURITY_HEAD3'],
    'student': ['STUDENT1', 'STUDENT2', 'STUDENT3', 'STUDENT4', 'STUDENT5'],
}

all_desired_usernames = set([uname for unames in roles_counts.values() for uname in unames])

# Ensure desired users exist and have Ram@9177
for role, unames in roles_counts.items():
    for uname in unames:
        u, created = User.objects.get_or_create(username=uname)
        u.role = role
        u.is_active = True
        u.set_password('Ram@9177')
        if role == 'super_admin':
            u.is_superuser = True
            u.is_staff = True
        elif role == 'admin':
            u.is_staff = True
        elif role == 'student':
            u.is_staff = False
        else:
            u.is_staff = True
        u.save()

# Delete everyone else
to_delete = User.objects.exclude(username__in=all_desired_usernames)
print(f"Deleting {to_delete.count()} extra users...")
to_delete.delete()

for role, unames in roles_counts.items():
    print(f"{role.upper()}: {', '.join(unames)}")
