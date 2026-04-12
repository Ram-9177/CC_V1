"""Add severity and student+created_at indexes to DisciplinaryAction."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('disciplinary', '0004_backfill_disciplinary_college'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='disciplinaryaction',
            index=models.Index(fields=['severity'], name='disc_severity_idx'),
        ),
        migrations.AddIndex(
            model_name='disciplinaryaction',
            index=models.Index(fields=['student', '-created_at'], name='disc_student_created_idx'),
        ),
    ]
