from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hostelconnect_auth', '0021_user_can_access_all_blocks'),
    ]

    operations = [
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['college', 'role', 'is_active'], name='auth_user_col_role_act_idx'),
        ),
    ]

