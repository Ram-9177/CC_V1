"""Celery application for CampusCore.

Workers are optimized for Hetzner CX33 (4 vCPU, 8 GB RAM):
  - concurrency=4 (one worker per vCPU)
  - prefetch_multiplier=1 (prevents one worker hoarding tasks)
  - max_tasks_per_child=200 (recycle workers to prevent memory leaks)

Start worker:
    celery -A hostelconnect worker -l info --concurrency=4 --prefetch-multiplier=1 --max-tasks-per-child=200

Queue split workers:
    celery -A hostelconnect worker -l info --concurrency=3 -Q default --prefetch-multiplier=1 --max-tasks-per-child=200
    celery -A hostelconnect worker -l info --concurrency=1 -Q heavy --prefetch-multiplier=1 --max-tasks-per-child=200

Start beat scheduler:
    celery -A hostelconnect beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
"""

import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'hostelconnect.settings.base')

app = Celery('hostelconnect')

# Load config from Django settings, namespace CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks in all INSTALLED_APPS
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
