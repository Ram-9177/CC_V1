import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from apps.auth.models import User
from rest_framework.test import APIClient

try:
    user = User.objects.get(username='ADMIN')
    print("User role:", user.role)
    client = APIClient()
    client.force_authenticate(user=user)

    resp = client.get('/api/rooms/mapping/')
    print("MAPPING STATUS:", resp.status_code)
    print("MAPPING RESULT:", resp.content)

    resp = client.get('/api/rooms/')
    print("ROOMS STATUS:", resp.status_code)

except Exception as e:
    print("Error:", repr(e))
