# Generated manually — StudentTypeAuditLog + StudentTypeChangeRequest
# Part of the Student Type Workflow System
# pyre-ignore-all-errors
# pyright: reportMissingImports=false
from django.conf import settings  # type: ignore[import]
from django.db import migrations, models  # type: ignore[import]
import django.db.models.deletion  # type: ignore[import]


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_tenant_users_tenan_college_06870a_idx_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='StudentTypeAuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True, null=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('old_type', models.CharField(max_length=20)),
                ('new_type', models.CharField(max_length=20)),
                ('change_request_id', models.IntegerField(blank=True, null=True)),
                ('notes', models.TextField(blank=True)),
                ('performed_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='type_changes_performed',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('student', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='type_change_logs',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
                'db_table': 'student_type_audit_log',
            },
        ),
        migrations.AddIndex(
            model_name='studenttypeauditlog',
            index=models.Index(fields=['student', '-created_at'], name='st_audit_student_idx'),
        ),
        migrations.AddIndex(
            model_name='studenttypeauditlog',
            index=models.Index(fields=['new_type', '-created_at'], name='st_audit_newtype_idx'),
        ),
        migrations.CreateModel(
            name='StudentTypeChangeRequest',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True, null=True)),
                ('updated_at', models.DateTimeField(auto_now=True, null=True)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('current_type', models.CharField(max_length=20)),
                ('new_type', models.CharField(max_length=20)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending Approval'),
                        ('approved', 'Approved'),
                        ('rejected', 'Rejected'),
                        ('executed', 'Executed'),
                    ],
                    default='pending',
                    max_length=20,
                )),
                ('reason', models.TextField(help_text='Why this change is being requested.')),
                ('rejection_reason', models.TextField(blank=True)),
                ('target_room_id', models.IntegerField(
                    blank=True,
                    null=True,
                    help_text='Required when converting day_scholar → hosteller',
                )),
                ('target_bed_id', models.IntegerField(
                    blank=True,
                    null=True,
                    help_text='Optional specific bed (auto-assigned if omitted)',
                )),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('executed_at', models.DateTimeField(blank=True, null=True)),
                ('student', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='type_change_requests',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('requested_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='type_change_requests_initiated',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('approved_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='type_change_requests_approved',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
                'db_table': 'student_type_change_request',
            },
        ),
        migrations.AddIndex(
            model_name='studenttypechangerequest',
            index=models.Index(fields=['student', 'status'], name='st_req_student_status_idx'),
        ),
        migrations.AddIndex(
            model_name='studenttypechangerequest',
            index=models.Index(fields=['status', '-created_at'], name='st_req_status_date_idx'),
        ),
    ]
