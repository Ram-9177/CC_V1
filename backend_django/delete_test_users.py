import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.auth.models import User

# Preserve main admins and any real named users.
# We will identify generic test users by checking patterns.
patterns = ['STRESS_STUDENT', 'STUDENT', 'WARDEN', 'HEAD_WARDEN', 'CHEF', 'HEAD_CHEF', 'GATE_SECURITY', 'SECURITY_HEAD', 'STAFF']

users_to_delete = []
for u in User.objects.all():
    if any(u.username.startswith(p) and any(char.isdigit() for char in u.username) for p in patterns):
        users_to_delete.append(u.id)

print(f"Found {len(users_to_delete)} STRESS/Generic test users to delete.")

# Delete them
User.objects.filter(id__in=users_to_delete).delete()
print("Deleted.")

# Print remaining users
print("Remaining users:")
for u in User.objects.all():
    print(u.username)

