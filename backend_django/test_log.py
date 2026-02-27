import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'smg_hostel.settings')
django.setup()

import logging
logger = logging.getLogger('django.request')
try:
    1/0
except Exception as e:
    logger.error("Test error", exc_info=True)
