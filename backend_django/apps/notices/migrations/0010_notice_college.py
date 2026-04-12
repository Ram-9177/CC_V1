"""Add college FK to Notice for SaaS isolation + backfill from author."""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('colleges', '0005_collegemoduleconfig'),
        ('notices', '0009_alter_notice_target_audience'),
    ]

    operations = [
        migrations.AddField(
            model_name='notice',
            name='college',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='notices',
                to='colleges.college',
                db_index=True,
            ),
        ),
        # Backfill: set college from the author's college
        migrations.RunSQL(
            sql="""
                UPDATE notices_notice
                SET college_id = (
                    SELECT college_id FROM hostelconnect_user
                    WHERE hostelconnect_user.id = notices_notice.author_id
                )
                WHERE college_id IS NULL;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
