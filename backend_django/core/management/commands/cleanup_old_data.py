from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.attendance.models import Attendance
from apps.gate_scans.models import GateScan
from apps.notifications.models import Notification
from apps.notifications.models import Notification
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Aggressively clean up old data to survive free-tier DB limits.'

    def handle(self, *args, **options):
        self.stdout.write("Starting cleanup...")
        
        # 1. Attendance: Keep 60 days
        # Old attendance is not useful for daily ops, but reports might need it.
        # Ideally we archive, but here we delete.
        days_60 = timezone.now() - timedelta(days=60)
        count, _ = Attendance.objects.filter(attendance_date__lt=days_60.date()).delete()
        self.stdout.write(f"Deleted {count} old attendance records.")
        
        # 2. Gate Scans: Keep 60 days
        # Security audits rarely go back >2 months for daily logs
        count, _ = GateScan.objects.filter(scan_time__lt=days_60).delete()
        self.stdout.write(f"Deleted {count} old gate scans.")
        
        # 3. Notifications: Keep 30 days
        # These are ephemeral
        days_30 = timezone.now() - timedelta(days=30)
        count, _ = Notification.objects.filter(created_at__lt=days_30).delete()
        self.stdout.write(f"Deleted {count} old notifications.")
        
        self.stdout.write(f"Deleted {count} old notifications.")
        
        self.stdout.write("Cleanup complete.")
