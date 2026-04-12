import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()
from apps.auth.models import User
from apps.auth.serializers import UserDetailSerializer
u = User.objects.first()
serializer = UserDetailSerializer(u)
import json
print(json.dumps(serializer.data, indent=2))
