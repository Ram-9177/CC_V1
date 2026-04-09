"""
Pytest configuration for Django tests
Includes fixtures, markers, and custom hooks
"""

import os
import django
from django.conf import settings

# Configure Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.test')
django.setup()


def pytest_configure(config):
    """Configure pytest"""
    settings.DEBUG = True
    settings.TESTING = True
    settings.DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': ':memory:',
        }
    }


def pytest_collection_modifyitems(config, items):
    """Mark test items with django_db marker if needed"""
    for item in items:
        if 'django_db' in item.keywords:
            continue
        if 'db' in str(item.fspath):
            item.add_marker('django_db')
