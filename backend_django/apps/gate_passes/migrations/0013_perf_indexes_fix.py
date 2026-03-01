# This migration is intentionally empty.
# The constraints that this was originally meant to remove were never created
# because migration 0012 was corrected to use AddIndex instead of AddConstraint.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('gate_passes', '0012_perf_indexes_phase1'),
    ]

    operations = [
        # No-op: indexes were correctly created in 0012 via AddIndex, not AddConstraint.
    ]
