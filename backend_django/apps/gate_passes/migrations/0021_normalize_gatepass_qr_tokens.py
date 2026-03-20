"""Normalize GatePass.qr_code to canonical GP:<uuid4> format.

Old format: GP_<12-char-hex>  (e.g. GP_A1B2C3D4E5F6)
New format: GP:<uuid4>        (e.g. GP:550e8400-e29b-41d4-a716-446655440000)

Existing tokens that already start with 'GP:' are left untouched.
Tokens in the old GP_<hex> format are replaced with a fresh UUID4.
Any other legacy format is also replaced.

This migration is safe to run multiple times (idempotent).
"""

import uuid
from django.db import migrations


def normalize_qr_tokens(apps, schema_editor):
    GatePass = apps.get_model('gate_passes', 'GatePass')
    to_update = []
    for gp in GatePass.objects.only('id', 'qr_code').iterator(chunk_size=500):
        if gp.qr_code and gp.qr_code.startswith('GP:'):
            continue  # already canonical
        gp.qr_code = f"GP:{uuid.uuid4()}"
        to_update.append(gp)
    if to_update:
        GatePass.objects.bulk_update(to_update, ['qr_code'], batch_size=500)


def reverse_normalize(apps, schema_editor):
    # Irreversible — old short tokens are gone; no safe rollback
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('gate_passes', '0020_backfill_gatepass_college'),
    ]

    operations = [
        migrations.RunPython(normalize_qr_tokens, reverse_normalize),
    ]
