"""Add college FK to Complaint."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('complaints', '0004_alter_complaint_options_alter_complaint_severity_and_more'),
        ('colleges', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='complaint',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='complaints',
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['college', 'status'], name='complaint_college_status_idx'),
        ),
        migrations.AddIndex(
            model_name='complaint',
            index=models.Index(fields=['college', '-created_at'], name='complaint_college_created_idx'),
        ),
    ]
