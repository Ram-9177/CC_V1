"""
Central Celery Tasks for CampusCore.
Ensures background processing of heavy operations, system-wide events, and cleanups.
"""
import logging
from celery import shared_task
from django.db import transaction
from django.utils import timezone
from core.models import SystemEvent
from apps.notifications.service import NotificationService

logger = logging.getLogger(__name__)


@shared_task(name='core.test_task')
def test_task():
    logger.info('[Celery] test_task executed successfully')
    return 'test_task_ok'

@shared_task(bind=True, max_retries=5)
def process_system_event(self, event_id: str):
    """
    Atomic Event Bus Consumer.
    Ensures 'at-least-once' delivery and prioritized execution.
    """
    try:
        with transaction.atomic():
            # select_for_update(skip_locked=True) is ideal for high-concurrency 
            # but select_for_update() + status check is safer for basic Celery setups.
            event = SystemEvent.objects.select_for_update().get(id=event_id, status='pending')
            
            try:
                # 1. Routing logic
                dispatch_event_to_handlers(event)
                
                # 2. Mark as processed
                event.status = 'processed'
                event.save(update_fields=['status'])
                
            except Exception as e:
                logger.error(f"[EventBus] Processing failed for {event.name} ({event.id}): {e}")
                event.retries += 1
                if event.retries >= self.max_retries:
                    event.status = 'failed_permanent'
                    event.save(update_fields=['status', 'retries'])
                    return
                
                event.status = 'failed'
                event.save(update_fields=['status', 'retries'])
                # Retry with exponential backoff
                raise self.retry(exc=e, countdown=2 ** event.retries)

    except SystemEvent.DoesNotExist:
        # Event already picked up by another worker or not pending
        pass

def dispatch_event_to_handlers(event: SystemEvent):
    """
    Switchboard for all internal event side-effects.
    Decouples core logic from low-latency HTTP responses.
    """
    name = event.name
    payload = event.payload
    
    # ─── 1. REAL-TIME BROADCASTS ──────────────────────────────────────────
    # All WebSocket updates go through here to avoid blocking the main server
    from core.event_service import broadcast_event
    broadcast_event(name, payload)

    # ─── 2. DOMAIN LOGIC ──────────────────────────────────────────────────
    
    # Gate Pass Side-Effects
    if name == 'gatepass.approved':
        # E.g., Notify student immediately via WebPush
        NotificationService.send_push(
            user_id=payload['student_id'],
            title="Gate Pass Approved",
            body="Your gate pass has been approved. You can now present it at the gate."
        )
    
    elif name == 'gatepass.exit':
        # E.g., Log entrance to institutional security audit
        pass

    # Complaint Side-Effects
    elif name == 'complaint.sla_breach':
        # Trigger high-priority alerts to Head Warden
        pass

    # ─── 3. ANALYTICS & LOGGING ──────────────────────────────────────────
    # Update pre-aggregated tables if needed (handled by separate periodic tasks too)
    pass

@shared_task
def run_daily_maintenance():
    """
    Institutional cleanups and metric recalibrations.
    """
    logger.info("[Maintenance] Running daily institutional maintenance...")
    # Clean up processed events older than 30 days
    SystemEvent.objects.filter(status='processed', created_at__lt=timezone.now() - timezone.timedelta(days=30)).delete()

@shared_task(name='core.test_task')
def test_task():
    logger.info('[Celery] test_task executed successfully')
    return 'test_task_ok'
