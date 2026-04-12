from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('disciplinary', '0007_disciplinaryaction_is_deleted_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='FineLedgerEntry',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('trace_id', models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, help_text='Global Trace ID for request correlation.')),
                ('tenant_id', models.CharField(blank=True, db_index=True, max_length=100, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('entry_type', models.CharField(choices=[('issued', 'Fine Issued'), ('adjustment', 'Fine Adjusted'), ('payment', 'Fine Paid'), ('reopened', 'Payment Reversed')], max_length=20)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('balance_after', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('notes', models.TextField(blank=True)),
                ('college', models.ForeignKey(blank=True, db_index=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fine_ledger_entries', to='colleges.college')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='fine_ledger_created', to=settings.AUTH_USER_MODEL)),
                ('disciplinary_action', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ledger_entries', to='disciplinary.disciplinaryaction')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='fine_ledger_entries', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='fineledgerentry',
            index=models.Index(fields=['student', '-created_at'], name='fineledger_student_created_idx'),
        ),
        migrations.AddIndex(
            model_name='fineledgerentry',
            index=models.Index(fields=['disciplinary_action', '-created_at'], name='fineledger_action_created_idx'),
        ),
        migrations.AddIndex(
            model_name='fineledgerentry',
            index=models.Index(fields=['entry_type'], name='fineledger_entry_type_idx'),
        ),
    ]
