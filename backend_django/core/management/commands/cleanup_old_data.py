from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.attendance.models import Attendance
from apps.gate_scans.models import GateScan
from apps.notifications.models import Notification
from apps.gate_passes.models import GatePass
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
        
        # 3.5. Expired Gatepasses: Clean up stale state data
        count, _ = GatePass.objects.filter(status='expired', created_at__lt=days_30).delete()
        self.stdout.write(f"Deleted {count} stale expired Gate Passes.")
        
        # 3.6. Audit Logs: Keep 90 days for compliance, wipe rest.
        from apps.operations.models import AuditAction
        days_90 = timezone.now() - timedelta(days=90)
        count, _ = AuditAction.objects.filter(created_at__lt=days_90).delete()
        self.stdout.write(f"Archived/Deleted {count} old operational Audit Logs.")
        
        # 4. Gate Pass Audio: Wipe after 10 days
        # Audio files are heavy; wipe after 10 days to save Cloudinary space
        days_10 = timezone.now() - timedelta(days=10)
        passes_to_wipe = GatePass.objects.filter(created_at__lt=days_10).exclude(audio_brief='')
        count = passes_to_wipe.count()
        for gp in passes_to_wipe:
            gp.audio_brief.delete(save=True) # This deletes from Cloudinary and saves model
        self.stdout.write(f"Wiped audio from {count} old gate passes.")
        
        self.stdout.write("Cleanup complete.")
