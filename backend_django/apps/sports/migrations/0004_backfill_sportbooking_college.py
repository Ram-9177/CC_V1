"""Data migration: backfill college on SportBooking from student.college."""

from django.db import migrations


def backfill(apps, schema_editor):
    SportBooking = apps.get_model('sports', 'SportBooking')
    db_alias = schema_editor.connection.alias
    qs = SportBooking.objects.using(db_alias).filter(college__isnull=True).select_related('student')
    to_update = []
    for obj in qs.iterator(chunk_size=500):
        college = getattr(obj.student, 'college', None) if obj.student else None
        if college is not None:
            obj.college = college
            to_update.append(obj)
        if len(to_update) >= 500:
            SportBooking.objects.using(db_alias).bulk_update(to_update, ['college'])
            to_update = []
    if to_update:
        SportBooking.objects.using(db_alias).bulk_update(to_update, ['college'])


class Migration(migrations.Migration):

    dependencies = [
        ('sports', '0003_sportbooking_college'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
