"""Data migration: backfill college on VisitorLog and VisitorPreRegistration from student.college."""

from django.db import migrations


def backfill_visitor_log(apps, schema_editor):
    VisitorLog = apps.get_model('visitors', 'VisitorLog')
    db_alias = schema_editor.connection.alias
    qs = VisitorLog.objects.using(db_alias).filter(college__isnull=True).select_related('student')
    to_update = []
    for obj in qs.iterator(chunk_size=500):
        college = getattr(obj.student, 'college', None) if obj.student else None
        if college is not None:
            obj.college = college
            to_update.append(obj)
        if len(to_update) >= 500:
            VisitorLog.objects.using(db_alias).bulk_update(to_update, ['college'])
            to_update = []
    if to_update:
        VisitorLog.objects.using(db_alias).bulk_update(to_update, ['college'])


def backfill_prereg(apps, schema_editor):
    VisitorPreRegistration = apps.get_model('visitors', 'VisitorPreRegistration')
    db_alias = schema_editor.connection.alias
    qs = VisitorPreRegistration.objects.using(db_alias).filter(college__isnull=True).select_related('student')
    to_update = []
    for obj in qs.iterator(chunk_size=500):
        college = getattr(obj.student, 'college', None) if obj.student else None
        if college is not None:
            obj.college = college
            to_update.append(obj)
        if len(to_update) >= 500:
            VisitorPreRegistration.objects.using(db_alias).bulk_update(to_update, ['college'])
            to_update = []
    if to_update:
        VisitorPreRegistration.objects.using(db_alias).bulk_update(to_update, ['college'])


class Migration(migrations.Migration):

    dependencies = [
        ('visitors', '0005_visitorlog_college'),
    ]

    operations = [
        migrations.RunPython(backfill_visitor_log, migrations.RunPython.noop),
        migrations.RunPython(backfill_prereg, migrations.RunPython.noop),
    ]
