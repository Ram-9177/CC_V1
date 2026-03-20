"""Add college FK to Event and EventRegistration."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0014_event_court_fk_to_sports'),
        ('colleges', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='events',
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='eventregistration',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='event_registrations',
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='event',
            index=models.Index(fields=['college', '-start_date'], name='event_college_date_idx'),
        ),
        migrations.AddIndex(
            model_name='eventregistration',
            index=models.Index(fields=['college', 'status'], name='ereg_college_status_idx'),
        ),
    ]
