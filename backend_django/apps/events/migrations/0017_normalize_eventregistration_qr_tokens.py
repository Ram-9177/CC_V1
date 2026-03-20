"""Normalize EventRegistration.qr_code_reference to canonical EV:<uuid4> format.

Existing NULL values and non-EV: prefixed values are replaced with fresh UUID4 tokens.
Records already in EV:<uuid4> format are left untouched.
"""

import uuid
from django.db import migrations


def normalize_qr_tokens(apps, schema_editor):
    EventRegistration = apps.get_model('events', 'EventRegistration')
    to_update = []
    for reg in EventRegistration.objects.only('id', 'qr_code_reference').iterator(chunk_size=500):
        if reg.qr_code_reference and reg.qr_code_reference.startswith('EV:'):
            continue  # already canonical
        reg.qr_code_reference = f"EV:{uuid.uuid4()}"
        to_update.append(reg)
    if to_update:
        EventRegistration.objects.bulk_update(to_update, ['qr_code_reference'], batch_size=500)


def reverse_normalize(apps, schema_editor):
    pass  # irreversible


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0016_backfill_eventregistration_college'),
    ]

    operations = [
        migrations.RunPython(normalize_qr_tokens, reverse_normalize),
    ]
