import logging
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from apps.gate_passes.models import GatePass
from apps.notifications.service import NotificationService

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Automatically expires stale pending or checked-out gate passes and wipes audio blobs.'

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting automated cleanup of stale gate passes...")
        
        now = timezone.now()
        yesterday = now - timedelta(hours=24)
        count_expired = 0
        count_audio_wiped = 0

        # Scenario 1: Still "Pending" well after the exit_date has passed
        stale_pending = GatePass.objects.filter(
            status='pending',
            exit_date__lt=now - timedelta(hours=6)  # Passed exit time by 6 hours
        )
        
        # Scenario 2: Still "Used" (Never returned) well after entry_date
        stale_used = GatePass.objects.filter(
            status='used',
            entry_date__lt=yesterday  # Was supposed to return 24 hours ago
        )
        
        # Scenario 3: Missing entry_date, but pass was 'day' pass and out for >24 hours
        stale_day_passes = GatePass.objects.filter(
            status='used', 
            entry_date__isnull=True,
            actual_exit_at__lt=yesterday
        )
        
        passes_to_expire = list(stale_pending) + list(stale_used) + list(stale_day_passes)
        # Deduplicate
        passes_dict = {p.id: p for p in passes_to_expire}
        
        for p in passes_dict.values():
            with transaction.atomic():
                p.status = 'expired'
                
                if p.audio_brief:
                    try:
                        p.audio_brief.delete(save=False)
                        count_audio_wiped += 1
                        logger.info(f"Wiped audio_brief for stale GatePass ID {p.id}")
                    except Exception as e:
                        logger.error(f"Failed to wipe audio_brief for GatePass {p.id}: {e}")
                        
                p.save(update_fields=['status', 'updated_at', 'audio_brief'])
                count_expired += 1
                
                # If they were out ("used") and never returned, alert Wardens!
                if p.actual_exit_at and not p.actual_entry_at:
                    msg = f"Alert: {p.student.get_full_name() or p.student.username} failed to check back in after 24 hours and the pass was auto-expired."
                    try:
                        NotificationService.send_to_role('warden', "Student Never Returned", msg, "alert", "/gate-passes")
                        NotificationService.send_to_role('head_warden', "Student Never Returned", msg, "alert", "/gate-passes")
                    except Exception as e:
                        logger.error(f"Failed to notify wardens of missing student {p.student.username}: {e}")

        self.stdout.write(self.style.SUCCESS(f"Successfully auto-expired {count_expired} passes and wiped {count_audio_wiped} audio brief files."))
