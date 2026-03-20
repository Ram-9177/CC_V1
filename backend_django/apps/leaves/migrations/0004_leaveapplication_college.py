"""Add college FK to LeaveApplication."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('leaves', '0003_alter_leaveapplication_status'),
        ('colleges', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='leaveapplication',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='leave_applications',
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='leaveapplication',
            index=models.Index(fields=['college', 'status'], name='leave_college_status_idx'),
        ),
        migrations.AddIndex(
            model_name='leaveapplication',
            index=models.Index(fields=['college', '-created_at'], name='leave_college_created_idx'),
        ),
    ]
