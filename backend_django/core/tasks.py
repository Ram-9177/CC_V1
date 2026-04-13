"""
Central Celery Tasks for CampusCore.
Ensures background processing of heavy operations, system-wide events, and cleanups.
"""
import logging
from celery import shared_task
from django.db import transaction
from django.utils import timezone
from core.models import SystemEvent, SystemEventDelivery
from core.event_observability import log_system_event, record_channel_delivery
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
                log_system_event(
                    event,
                    'processing_start',
                    {'name': event.name, 'trace_id': str(event.trace_id)},
                )
                # 1. Routing logic
                dispatch_event_to_handlers(event)
                
                # 2. Mark as processed
                event.status = 'processed'
                event.save(update_fields=['status'])
                log_system_event(event, 'dispatch_ok', {'name': event.name})
                
            except Exception as e:
                logger.error(f"[EventBus] Processing failed for {event.name} ({event.id}): {e}")
                try:
                    log_system_event(
                        event,
                        'dispatch_fail',
                        {'error': str(e), 'name': event.name},
                    )
                except Exception:
                    logger.debug("event observability log failed", exc_info=True)
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
    raw_payload = event.payload
    payload = raw_payload if isinstance(raw_payload, dict) else {}
    tenant_hint = None
    if isinstance(payload.get('tenant_id'), str):
        tenant_hint = payload['tenant_id']

    log_system_event(
        event,
        'dispatch_start',
        {'name': name, 'trace_id': str(event.trace_id)},
    )

    # ─── 1. REAL-TIME BROADCASTS ──────────────────────────────────────────
    # All WebSocket updates go through here to avoid blocking the main server
    from core.event_service import broadcast_event

    ws_ok = broadcast_event(name, raw_payload if isinstance(raw_payload, dict) else {})
    record_channel_delivery(
        event,
        SystemEventDelivery.CHANNEL_WEBSOCKET,
        ok=ws_ok,
        error_message='' if ws_ok else 'broadcast_event returned False',
        tenant_id=tenant_hint,
    )

    # ─── 2. DOMAIN LOGIC ──────────────────────────────────────────────────

    # Gate Pass Side-Effects
    if name == 'gatepass.approved' and 'student_id' in payload:
        push_ok = True
        push_err = ''
        try:
            NotificationService.send_push(
                user_id=payload['student_id'],
                title="Gate Pass Approved",
                body="Your gate pass has been approved. You can now present it at the gate."
            )
        except Exception as ex:
            push_ok = False
            push_err = str(ex)
            logger.warning("send_push failed for gatepass.approved: %s", ex)
        record_channel_delivery(
            event,
            SystemEventDelivery.CHANNEL_PUSH,
            ok=push_ok,
            error_message=push_err,
            tenant_id=tenant_hint,
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
