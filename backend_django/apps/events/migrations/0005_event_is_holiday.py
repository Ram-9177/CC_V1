from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0004_event_trace_id_eventregistration_college_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='is_holiday',
            field=models.BooleanField(default=False),
        ),
    ]
