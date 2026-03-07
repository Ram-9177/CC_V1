import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()
from apps.gate_passes.views import GatePassViewSet
print('imported GatePassViewSet successfully')
