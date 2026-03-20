"""Add college FK to HallBooking."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('hall_booking', '0002_hall_slots_equipment_attendance_and_workflow'),
        ('colleges', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='hallbooking',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='hall_bookings',
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='hallbooking',
            index=models.Index(fields=['college', 'status'], name='hb_college_status_idx'),
        ),
        migrations.AddIndex(
            model_name='hallbooking',
            index=models.Index(fields=['college', 'booking_date'], name='hb_college_date_idx'),
        ),
    ]
