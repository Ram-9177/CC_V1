"""Add college FK to EventTicket for SaaS isolation."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('colleges', '0005_collegemoduleconfig'),
        ('events', '0019_eventregistration_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='eventticket',
            name='college',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='event_tickets',
                to='colleges.college',
                db_index=True,
            ),
        ),
        # Backfill: set college from the related event
        migrations.RunSQL(
            sql="""
                UPDATE events_tickets
                SET college_id = (
                    SELECT college_id FROM events_event
                    WHERE events_event.id = events_tickets.event_id
                )
                WHERE college_id IS NULL;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
