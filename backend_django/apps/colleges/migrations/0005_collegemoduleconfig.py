"""Create CollegeModuleConfig — per-college module enable/disable."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('colleges', '0004_college_saas_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='CollegeModuleConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('module_name', models.CharField(
                    max_length=50,
                    help_text='Module slug matching core.rbac module constants (e.g. hostel, sports, hall).',
                )),
                ('is_enabled', models.BooleanField(
                    default=True,
                    help_text='When False, all API access to this module is blocked for this college.',
                )),
                ('college', models.ForeignKey(
                    to='colleges.College',
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='module_configs',
                )),
            ],
            options={
                'db_table': 'colleges_moduleconfig',
                'ordering': ['college', 'module_name'],
                'unique_together': {('college', 'module_name')},
            },
        ),
    ]
