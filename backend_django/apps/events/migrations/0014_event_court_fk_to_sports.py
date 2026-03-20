# Migration: Re-point Event.court FK from events.SportsCourt → sports.SportCourt
# This completes the sports system isolation (Phase 2 stabilization).
# The events.SportsCourt table (events_sportscourt) is left intact to avoid data loss.
# It is now orphaned — safe to drop manually after confirming no live data references it.

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0013_eventregistration_scan_method'),
        ('sports', '0001_initial'),
    ]

    operations = [
        # Step 1: Change the FK to point to sports.SportCourt
        # related_name changes from 'slots' → 'event_slots' to avoid clash with
        # sports.CourtSlot which already uses related_name='slots' on SportCourt.
        migrations.AlterField(
            model_name='event',
            name='court',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='event_slots',
                to='sports.sportcourt',
            ),
        ),
    ]
