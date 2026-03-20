"""Data migration: backfill college on Notification from recipient.college."""

from django.db import migrations


def backfill(apps, schema_editor):
    Notification = apps.get_model('notifications', 'Notification')
    db_alias = schema_editor.connection.alias
    qs = Notification.objects.using(db_alias).filter(
        college__isnull=True, recipient__isnull=False
    ).select_related('recipient')
    to_update = []
    for obj in qs.iterator(chunk_size=500):
        college = getattr(obj.recipient, 'college', None) if obj.recipient else None
        if college is not None:
            obj.college = college
            to_update.append(obj)
        if len(to_update) >= 500:
            Notification.objects.using(db_alias).bulk_update(to_update, ['college'])
            to_update = []
    if to_update:
        Notification.objects.using(db_alias).bulk_update(to_update, ['college'])


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0006_notification_college'),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
