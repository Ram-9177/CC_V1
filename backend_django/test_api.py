import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')
django.setup()
from apps.gate_passes.models import GatePass
from apps.gate_passes.serializers import GatePassSerializer
gp = GatePass.objects.first()
res = GatePassSerializer(gp).data
print("Keys:", res.keys())
print("student_details exists?", "student_details" in res)
print("student_details type:", type(res.get("student_details")))
