"""Data migration: backfill college on HallBooking from requester.college."""

from django.db import migrations


def backfill(apps, schema_editor):
    HallBooking = apps.get_model('hall_booking', 'HallBooking')
    db_alias = schema_editor.connection.alias
    qs = HallBooking.objects.using(db_alias).filter(college__isnull=True).select_related('requester')
    to_update = []
    for obj in qs.iterator(chunk_size=500):
        college = getattr(obj.requester, 'college', None) if obj.requester else None
        if college is not None:
            obj.college = college
            to_update.append(obj)
        if len(to_update) >= 500:
            HallBooking.objects.using(db_alias).bulk_update(to_update, ['college'])
            to_update = []
    if to_update:
        HallBooking.objects.using(db_alias).bulk_update(to_update, ['college'])


class Migration(migrations.Migration):

    dependencies = [
        ('hall_booking', '0003_hallbooking_college'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
