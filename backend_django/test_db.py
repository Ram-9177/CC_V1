import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.rooms.models import Building
buildings = Building.objects.all()
for b in buildings:
    print(f"Building: {b.name}, id: {b.id}, floors: {b.total_floors}, rooms: {b.rooms.count()}")
