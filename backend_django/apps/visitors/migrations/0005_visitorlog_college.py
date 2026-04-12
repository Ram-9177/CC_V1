"""Add college FK to VisitorLog and VisitorPreRegistration."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('visitors', '0004_add_performance_indexes'),
        ('colleges', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='visitorlog',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='visitor_logs',
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name='visitorpreregistration',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='visitor_pre_registrations',
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='visitorlog',
            index=models.Index(fields=['college', '-check_in'], name='visitor_college_checkin_idx'),
        ),
    ]
