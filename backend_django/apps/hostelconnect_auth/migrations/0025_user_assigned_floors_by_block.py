from django.db import migrations, models


def reset_legacy_floor_scope(apps, schema_editor):
    User = apps.get_model('hostelconnect_auth', 'User')
    User.objects.filter(role__in=['warden', 'hr', 'head_warden']).update(
        assigned_floors=[],
        assigned_floors_by_block={},
    )


def noop_reverse(apps, schema_editor):
    return


class Migration(migrations.Migration):

    dependencies = [
        ('hostelconnect_auth', '0024_user_assigned_hostels'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='assigned_floors_by_block',
            field=models.JSONField(
                blank=True,
                default=dict,
                help_text='Mapping of building IDs to floor number lists for scoped Warden/HR access.',
            ),
        ),
        migrations.RunPython(reset_legacy_floor_scope, noop_reverse),
    ]
