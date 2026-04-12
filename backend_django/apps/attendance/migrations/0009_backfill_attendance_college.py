"""Data migration: backfill college on Attendance from user.college."""

from django.db import migrations


def backfill(apps, schema_editor):
    Attendance = apps.get_model('attendance', 'Attendance')
    db_alias = schema_editor.connection.alias
    qs = Attendance.objects.using(db_alias).filter(college__isnull=True).select_related('user')
    to_update = []
    for obj in qs.iterator(chunk_size=500):
        college = getattr(obj.user, 'college', None) if obj.user else None
        if college is not None:
            obj.college = college
            to_update.append(obj)
        if len(to_update) >= 500:
            Attendance.objects.using(db_alias).bulk_update(to_update, ['college'])
            to_update = []
    if to_update:
        Attendance.objects.using(db_alias).bulk_update(to_update, ['college'])


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0008_attendance_college'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
