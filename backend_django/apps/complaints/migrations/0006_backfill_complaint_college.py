"""Data migration: backfill college on Complaint from student.college."""

from django.db import migrations


def backfill(apps, schema_editor):
    Complaint = apps.get_model('complaints', 'Complaint')
    db_alias = schema_editor.connection.alias
    qs = Complaint.objects.using(db_alias).filter(college__isnull=True).select_related('student')
    to_update = []
    for obj in qs.iterator(chunk_size=500):
        college = getattr(obj.student, 'college', None) if obj.student else None
        if college is not None:
            obj.college = college
            to_update.append(obj)
        if len(to_update) >= 500:
            Complaint.objects.using(db_alias).bulk_update(to_update, ['college'])
            to_update = []
    if to_update:
        Complaint.objects.using(db_alias).bulk_update(to_update, ['college'])


class Migration(migrations.Migration):

    dependencies = [
        ('complaints', '0005_complaint_college'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
