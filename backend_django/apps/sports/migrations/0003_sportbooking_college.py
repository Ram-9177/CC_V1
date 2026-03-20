"""Add college FK to SportBooking."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('sports', '0002_sportbooking_scan_method'),
        ('colleges', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='sportbooking',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='sport_bookings',
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='sportbooking',
            index=models.Index(fields=['college', 'status'], name='sb_college_status_idx'),
        ),
        migrations.AddIndex(
            model_name='sportbooking',
            index=models.Index(fields=['college', '-created_at'], name='sb_college_created_idx'),
        ),
    ]
