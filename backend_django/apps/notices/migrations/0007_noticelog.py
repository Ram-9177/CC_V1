# Generated manually to add the missing NoticeLog model.
# The NoticeLog model was added to apps/notices/models.py but no migration was created.

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notices', '0006_alter_notice_created_at_alter_notice_deleted_at'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='NoticeLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('deleted_at', models.DateTimeField(blank=True, db_index=True, default=None, null=True)),
                ('target_role', models.CharField(max_length=50)),
                ('users_notified_count', models.PositiveIntegerField(default=0)),
                ('notice', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='logs',
                    to='notices.notice',
                )),
                ('sender', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'notices_noticelog',
                'ordering': ['-created_at'],
            },
        ),
    ]
