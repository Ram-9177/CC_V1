from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from apps.attendance.models import Attendance
from apps.gate_passes.models import GateScan

class Command(BaseCommand):
    help = 'Clean up old attendance and gate scan records to prevent free-tier database overflow.'

    def handle(self, *args, **options):
        # Retention policy: 60 days
        cutoff_date = timezone.now() - timedelta(days=60)
        cutoff_date_date = cutoff_date.date()

        self.stdout.write(f"Deleting records older than {cutoff_date_date}...")

        # Gate Scans (High volume)
        scans_deleted, _ = GateScan.objects.filter(scan_time__lt=cutoff_date).delete()
        self.stdout.write(f"Deleted {scans_deleted} old gate scans.")

        # Attendance (Medium volume)
        # Note: Attendance uses DateField, so compare with date object
        attendance_deleted, _ = Attendance.objects.filter(attendance_date__lt=cutoff_date_date).delete()
        self.stdout.write(f"Deleted {attendance_deleted} old attendance records.")

        # Notifications (High volume, 30 days retention)
        from apps.notifications.models import Notification
        notification_cutoff = timezone.now() - timedelta(days=30)
        notifs_deleted, _ = Notification.objects.filter(created_at__lt=notification_cutoff).delete()
        self.stdout.write(f"Deleted {notifs_deleted} old notifications.")

        # Complaints (Resolved > 90 days)
        from apps.complaints.models import Complaint
        complaint_cutoff = timezone.now() - timedelta(days=90)
        complaints_deleted, _ = Complaint.objects.filter(
            status='resolved',
            resolved_at__lt=complaint_cutoff
        ).delete()
        self.stdout.write(f"Deleted {complaints_deleted} old resolved complaints.")

        self.stdout.write(self.style.SUCCESS('Cleanup complete.'))
