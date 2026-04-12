from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0006_remove_event_deleted_at_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='external_link',
            field=models.CharField(blank=True, max_length=500, null=True),
        ),
    ]

