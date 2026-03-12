from django.db.models.signals import post_migrate
from django.dispatch import receiver
from .models import SportsBookingConfig

@receiver(post_migrate)
def ensure_default_config(sender, **kwargs):
    if sender.name == 'apps.events':
        if not SportsBookingConfig.objects.exists():
            SportsBookingConfig.objects.create(
                max_bookings_per_day=2,
                max_bookings_per_week=5
            )
            print("Default SportsBookingConfig created.")
