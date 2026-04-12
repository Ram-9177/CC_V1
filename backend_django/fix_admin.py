import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from apps.auth.models import User

def fix():
    for uname in ['SUPERADMIN', 'ADMIN']:
        u, _ = User.objects.get_or_create(username=uname)
        u.set_password('Ram@9177')
        u.is_active = True
        u.is_staff = True
        u.is_superuser = True if uname == 'SUPERADMIN' else False
        u.save()
        print(f"Fixed {uname}")

if __name__ == '__main__':
    fix()
