"""Add college FK to DisciplinaryAction."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('disciplinary', '0002_alter_disciplinaryaction_created_at_and_more'),
        ('colleges', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='disciplinaryaction',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='disciplinary_actions',
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='disciplinaryaction',
            index=models.Index(fields=['college', '-created_at'], name='disc_college_created_idx'),
        ),
    ]
