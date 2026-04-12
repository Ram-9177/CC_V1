"""Add SaaS fields to College model.

- subscription_status: free / starter / pro / enterprise
- plan: mirrors subscription_status for display
- max_users: hard cap on total users (0 = unlimited)
- logo: college logo image
- primary_color: hex colour for light branding
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('colleges', '0003_alter_college_created_at_alter_college_deleted_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='college',
            name='subscription_status',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('free', 'Free'),
                    ('starter', 'Starter'),
                    ('pro', 'Pro'),
                    ('enterprise', 'Enterprise'),
                ],
                default='free',
                help_text='SaaS subscription tier for this college.',
            ),
        ),
        migrations.AddField(
            model_name='college',
            name='max_users',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Maximum total users allowed (0 = unlimited).',
            ),
        ),
        migrations.AddField(
            model_name='college',
            name='logo',
            field=models.ImageField(
                upload_to='college_logos/',
                null=True,
                blank=True,
                help_text='College logo shown in the app header.',
            ),
        ),
        migrations.AddField(
            model_name='college',
            name='primary_color',
            field=models.CharField(
                max_length=7,
                blank=True,
                default='',
                help_text='Hex colour code for light branding (e.g. #6366F1).',
            ),
        ),
    ]
