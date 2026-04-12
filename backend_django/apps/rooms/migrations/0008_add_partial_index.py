from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0007_alter_room_amenities_alter_room_room_type_and_more'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='roomallocation',
            index=models.Index(
                fields=['student'],
                condition=models.Q(end_date__isnull=True),
                name='idx_active_allocations'
            ),
        ),
    ]
