"""Add college FK to GatePass and GateScan for multi-tenant isolation."""

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('gate_passes', '0018_gatescan_scan_method'),
        ('colleges', '0001_initial'),
    ]

    operations = [
        # GatePass
        migrations.AddField(
            model_name='gatepass',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='gate_passes',
                db_index=True,
            ),
        ),
        migrations.AddIndex(
            model_name='gatepass',
            index=models.Index(fields=['college', 'status'], name='gp_college_status_idx'),
        ),
        migrations.AddIndex(
            model_name='gatepass',
            index=models.Index(fields=['college', '-created_at'], name='gp_college_created_idx'),
        ),
        # GateScan
        migrations.AddField(
            model_name='gatescan',
            name='college',
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='colleges.college',
                related_name='gate_scans',
                db_index=True,
            ),
        ),
    ]
