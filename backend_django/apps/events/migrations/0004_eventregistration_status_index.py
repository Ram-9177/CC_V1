from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0003_event_is_exam_event_is_holiday'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='eventregistration',
            index=models.Index(fields=['status'], name='events_reg_status_idx'),
        ),
    ]
