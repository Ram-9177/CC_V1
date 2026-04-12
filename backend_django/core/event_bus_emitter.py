"""
Transactional Event Outbox Emitter
Phase 13: Final Architecture Consolidation
"""
from core.models import SystemEvent
import logging

logger = logging.getLogger(__name__)

def emit_event(name: str, payload: dict, priority: str = 'medium'):
    """
    Persists the event in the outbox to guarantee it's committed to the database.
    Then, it defers actual processing to Celery so the HTTP thread isn't blocked.
    
    Resilience Logic (Institutional):
    If the event is high-priority or 'Fail-Safe Mode' is active, the system
    may attempt immediate synchronous processing to ensure zero operational lag.
    """
    from django.conf import settings
    from django.core.cache import cache
    from django.db import transaction
    from core.tasks import process_system_event
    
    # Check for Institutional Fail-Safe Override
    is_fail_safe_active = cache.get("CAMPUSCORE_FAIL_SAFE_MODE", False) or getattr(settings, 'FAIL_SAFE_MODE_ENABLED', False)

    try:
        # 1. Atomic Outbox Persistence
        event = SystemEvent.objects.create(name=name, payload=payload, priority=priority)
        
        # 2. Institutional Resiliency Trigger
        def _trigger():
            # If critical or in Fail-Safe mode, trigger synchronously to bypass worker lag
            if is_fail_safe_active or priority == 'high':
                try:
                    # Sync Execution (Institutional Safety)
                    process_system_event(str(event.id))
                    event.status = 'processed'
                    event.save(update_fields=['status'])
                    return
                except Exception as ex:
                    logger.warning(f"Fail-Safe sync-execution failed for {event.id}: {str(ex)}")
            
            # Standard Asynchronous Dispatch (Worker processing)
            process_system_event.delay(str(event.id))
            
        transaction.on_commit(_trigger)
        return event
    except Exception as e:
        logger.error(f"Failed to emit SystemEvent({name}): {str(e)}", exc_info=True)
        return None
