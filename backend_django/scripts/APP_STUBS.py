"""Minimal app stubs - expand these with full implementations"""

# colleges/apps.py
from django.apps import AppConfig
class CollegesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.colleges'

# colleges/models.py - Add model classes here
# colleges/serializers.py - Add serializers here
# colleges/views.py - Add viewsets here
# colleges/urls.py - Add URL routing here

# rooms/apps.py
from django.apps import AppConfig
class RoomsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.rooms'

# meals/apps.py
from django.apps import AppConfig
class MealsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.meals'

# attendance/apps.py
from django.apps import AppConfig
class AttendanceConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.attendance'

# gate_passes/apps.py
from django.apps import AppConfig
class GatePassesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.gate_passes'

# gate_scans/apps.py
from django.apps import AppConfig
class GateScansConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.gate_scans'

# events/apps.py
from django.apps import AppConfig
class EventsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.events'

# notices/apps.py
from django.apps import AppConfig
class NoticesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notices'

# notifications/apps.py
from django.apps import AppConfig
class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notifications'

# reports/apps.py
from django.apps import AppConfig
class ReportsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.reports'

# metrics/apps.py
from django.apps import AppConfig
class MetricsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.metrics'

# health/apps.py
from django.apps import AppConfig
class HealthConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.health'
