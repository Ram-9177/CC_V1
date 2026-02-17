from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("meals", "0005_chef_menu_feedback_authorities"),
    ]

    operations = [
        migrations.AddField(
            model_name="menunotification",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True, default=None),
        ),
    ]
