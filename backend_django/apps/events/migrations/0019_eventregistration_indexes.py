"""
Add composite indexes to EventRegistration for common query patterns:
  - (event, status)  — attendance/check-in queries
  - (student, status) — student's own registrations by status
  - (college, status) — college-scoped status queries
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0018_event_indexes'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='eventregistration',
            index=models.Index(
                fields=['event', 'status'],
                name='evtreg_event_status_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='eventregistration',
            index=models.Index(
                fields=['student', 'status'],
                name='evtreg_student_status_idx',
            ),
        ),
        migrations.AddIndex(
            model_name='eventregistration',
            index=models.Index(
                fields=['college', 'status'],
                name='evtreg_college_status_idx',
            ),
        ),
    ]
