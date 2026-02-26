import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()

from rest_framework.permissions import BasePermission
from core.permissions import IsManagement, IsStudent

class MetaTester:
    permission_classes = [IsManagement | IsStudent]

print(MetaTester.permission_classes)
p = MetaTester.permission_classes[0]()
print(p)
