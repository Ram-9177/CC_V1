import logging
from django.contrib.contenttypes.models import ContentType
from apps.audit.models import AuditLog

logger = logging.getLogger(__name__)

def log_action(user, action, instance, changes=None, request=None):
    """
    Log a critical institutional action.
    """
    try:
        ip = None
        ua = ''
        if request:
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0].strip()
            else:
                ip = request.META.get('REMOTE_ADDR')
            ua = request.META.get('HTTP_USER_AGENT', '')

        AuditLog.objects.create(
            actor=user if user and user.is_authenticated else None,
            action=action,
            resource_type=instance.__class__.__name__,
            resource_id=str(instance.pk),
            changes=changes or {},
            ip_address=ip,
            user_agent=ua
        )
    except Exception as e:
        logger.error(f"Audit logging failed: {str(e)}")
