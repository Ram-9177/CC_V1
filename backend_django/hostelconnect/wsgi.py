"""
WSGI config for hostelconnect project.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')

application = get_wsgi_application()
