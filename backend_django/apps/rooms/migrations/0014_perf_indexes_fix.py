# This migration is intentionally empty.
# The constraint that this was originally meant to remove was never created
# because migration 0013 was corrected to use AddIndex instead of AddConstraint.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('rooms', '0013_perf_indexes_phase1'),
    ]

    operations = [
        # No-op: alloc_active_student_room_idx was correctly created in 0013 via AddIndex.
    ]
