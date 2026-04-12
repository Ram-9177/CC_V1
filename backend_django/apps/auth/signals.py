from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import User
from websockets.broadcast import notify_user_updated, notify_profile_updated

@receiver(post_save, sender=User)
def user_broadcast_signals(sender, instance, created, **kwargs):
    """
    Broadcast user changes (activation, role) and profile updates.
    """
    if created:
        notify_user_updated(instance)
    else:
        # Check update_fields to minimize noise if possible
        update_fields = kwargs.get('update_fields')
        if update_fields:
            if 'is_active' in update_fields or 'role' in update_fields:
                notify_user_updated(instance)
            if 'profile_picture' in update_fields:
                notify_profile_updated(instance.id)
        else:
            # Full save (e.g. from Admin UI or setUser)
            notify_user_updated(instance)
            # Profile update might be needed too
            notify_profile_updated(instance.id)
