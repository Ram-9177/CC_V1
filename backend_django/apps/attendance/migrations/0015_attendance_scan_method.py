from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0014_attendancereport_college_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='attendance',
            name='scan_method',
            field=models.CharField(choices=[('qr', 'QR Scan'), ('manual', 'Manual Search')], default='qr', max_length=10),
        ),
    ]