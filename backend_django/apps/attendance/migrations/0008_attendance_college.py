"""Add college FK to Attendance."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0007_attendancereport_attendance__user_id_6b1302_idx_and_more'),
        ('colleges', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendance',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='attendance_records',
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='attendance',
            index=models.Index(fields=['college', 'attendance_date'], name='att_college_date_idx'),
        ),
        migrations.AddIndex(
            model_name='attendance',
            index=models.Index(fields=['college', 'status'], name='att_college_status_idx'),
        ),
    ]
