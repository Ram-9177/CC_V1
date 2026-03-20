from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('colleges', '0005_collegemoduleconfig'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ResumeProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('full_name', models.CharField(blank=True, max_length=200)),
                ('email', models.EmailField(blank=True, max_length=254)),
                ('phone', models.CharField(blank=True, max_length=20)),
                ('linkedin', models.URLField(blank=True)),
                ('github', models.URLField(blank=True)),
                ('course', models.CharField(blank=True, max_length=100)),
                ('branch', models.CharField(blank=True, max_length=100)),
                ('year', models.CharField(blank=True, max_length=20)),
                ('skills', models.JSONField(blank=True, default=list)),
                ('education', models.JSONField(blank=True, default=list)),
                ('projects', models.JSONField(blank=True, default=list)),
                ('experience', models.JSONField(blank=True, default=list)),
                ('achievements', models.JSONField(blank=True, default=list)),
                ('certifications', models.JSONField(blank=True, default=list)),
                ('summary', models.TextField(blank=True)),
                ('selected_template', models.CharField(
                    choices=[('classic', 'Classic'), ('modern', 'Modern'), ('compact', 'Compact'), ('student_focus', 'Student Focus')],
                    default='classic', max_length=30,
                )),
                ('generated_resume', models.JSONField(blank=True, null=True)),
                ('last_generated_at', models.DateTimeField(blank=True, null=True)),
                ('generation_date', models.DateField(blank=True, null=True)),
                ('generation_count', models.PositiveSmallIntegerField(default=0)),
                ('college', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='resume_profiles',
                    to='colleges.college',
                )),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='resume_profile',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'abstract': False},
        ),
        migrations.AddIndex(
            model_name='resumeprofile',
            index=models.Index(fields=['user'], name='resume_profile_user_idx'),
        ),
        migrations.AddIndex(
            model_name='resumeprofile',
            index=models.Index(fields=['college'], name='resume_profile_college_idx'),
        ),
    ]
