"""Data migration: backfill college on LeaveApplication from student.college."""

from django.db import migrations


def backfill(apps, schema_editor):
    LeaveApplication = apps.get_model('leaves', 'LeaveApplication')
    db_alias = schema_editor.connection.alias
    qs = LeaveApplication.objects.using(db_alias).filter(college__isnull=True).select_related('student')
    to_update = []
    for obj in qs.iterator(chunk_size=500):
        college = getattr(obj.student, 'college', None) if obj.student else None
        if college is not None:
            obj.college = college
            to_update.append(obj)
        if len(to_update) >= 500:
            LeaveApplication.objects.using(db_alias).bulk_update(to_update, ['college'])
            to_update = []
    if to_update:
        LeaveApplication.objects.using(db_alias).bulk_update(to_update, ['college'])


class Migration(migrations.Migration):

    dependencies = [
        ('leaves', '0004_leaveapplication_college'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
