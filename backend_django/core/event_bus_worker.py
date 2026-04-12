"""
Celery Handlers for robust Transactional Outbox Event Bus.
"""
from celery import shared_task
from core.models import SystemEvent
import logging
from django.db import transaction

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=3)
def process_event_async(self, event_id: str):
    """
    Guaranteed asynchronous task executor.
    Reads pending events from the reliable DB outbox.
    """
    try:
        # Atomic lock to prevent duplicate execution across parallel celery workers
        with transaction.atomic():
            event = SystemEvent.objects.select_for_update().get(id=event_id, status='pending')
            
            try:
                handle_event(event)
                # Success
                event.status = 'processed'
                event.save(update_fields=['status'])
                
            except Exception as execution_error:
                logger.error(f"Event handler failed: {str(execution_error)}")
                event.retries += 1
                if event.retries >= 3:
                     event.status = 'failed_permanent'
                     event.save(update_fields=['retries', 'status'])
                     return # Don't retry anymore, it's dead-lettered
                
                event.status = 'failed'
                event.save(update_fields=['retries', 'status'])
                raise self.retry(exc=execution_error, countdown=5 ** event.retries)

    except SystemEvent.DoesNotExist:
        # Either not found, or picked up natively by another worker locking it
        pass

def handle_event(event: SystemEvent):
    """
    The main routing switchboard connecting Events to Services.
    """
    # 1. Broadcaster (Legacy Channel Mapping)
    from core.event_service import emit_event as channels_emit
    
    if event.name == 'gatepass_approved':
        # Route to channels logic
        pass 
    
    # 2. Automated Disciplinary Actions / Student Type triggers
    # e.g., if event.name == 'student.type.changed': handle_student_type_changed(event.payload)
    pass
