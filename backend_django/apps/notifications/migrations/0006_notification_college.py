"""Add college FK to Notification."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0005_notification_target_audience_and_more'),
        ('colleges', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='notification',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='notifications',
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['college', '-created_at'], name='notif_college_created_idx'),
        ),
    ]
