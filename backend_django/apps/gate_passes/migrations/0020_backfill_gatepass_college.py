"""Data migration: backfill college on GatePass and GateScan from student.college."""

from django.db import migrations


def backfill_gatepass_college(apps, schema_editor):
    GatePass = apps.get_model('gate_passes', 'GatePass')
    db_alias = schema_editor.connection.alias
    qs = GatePass.objects.using(db_alias).filter(college__isnull=True).select_related('student')
    to_update = []
    for gp in qs.iterator(chunk_size=500):
        college = getattr(gp.student, 'college', None) if gp.student else None
        if college is not None:
            gp.college = college
            to_update.append(gp)
        if len(to_update) >= 500:
            GatePass.objects.using(db_alias).bulk_update(to_update, ['college'])
            to_update = []
    if to_update:
        GatePass.objects.using(db_alias).bulk_update(to_update, ['college'])


def backfill_gatescan_college(apps, schema_editor):
    GateScan = apps.get_model('gate_passes', 'GateScan')
    db_alias = schema_editor.connection.alias
    qs = GateScan.objects.using(db_alias).filter(college__isnull=True).select_related('student')
    to_update = []
    for gs in qs.iterator(chunk_size=500):
        college = getattr(gs.student, 'college', None) if gs.student else None
        if college is not None:
            gs.college = college
            to_update.append(gs)
        if len(to_update) >= 500:
            GateScan.objects.using(db_alias).bulk_update(to_update, ['college'])
            to_update = []
    if to_update:
        GateScan.objects.using(db_alias).bulk_update(to_update, ['college'])


class Migration(migrations.Migration):

    dependencies = [
        ('gate_passes', '0019_gatepass_college'),
    ]

    operations = [
        migrations.RunPython(backfill_gatepass_college, migrations.RunPython.noop),
        migrations.RunPython(backfill_gatescan_college, migrations.RunPython.noop),
    ]
