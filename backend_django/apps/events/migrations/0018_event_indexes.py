"""Add college+start_date and is_holiday+start_date indexes to Event."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0017_normalize_eventregistration_qr_tokens'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='event',
            index=models.Index(fields=['college', '-start_date'], name='events_college_start_idx'),
        ),
        migrations.AddIndex(
            model_name='event',
            index=models.Index(fields=['is_holiday', 'start_date'], name='events_holiday_start_idx'),
        ),
    ]
