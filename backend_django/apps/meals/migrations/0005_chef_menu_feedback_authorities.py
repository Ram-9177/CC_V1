# Generated migration for Chef menu posting and feedback privacy features

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('meals', '0004_mealspecialrequest'),
    ]

    operations = [
        # Add fields to Meal model for menu posting
        migrations.AddField(
            model_name='meal',
            name='menu_posted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='meal',
            name='posted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='meal',
            name='posted_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='menus_posted', to=settings.AUTH_USER_MODEL),
        ),
        
        # Add fields to MealFeedback model for privacy support
        migrations.AddField(
            model_name='mealfeedback',
            name='feedback_type',
            field=models.CharField(
                choices=[('private', 'Private (HR only to Chef)'), ('public', 'Public (All students can respond)')],
                default='private',
                max_length=20
            ),
        ),
        migrations.AddField(
            model_name='mealfeedback',
            name='is_published_by_hr',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='mealfeedback',
            name='published_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        
        # Create MenuNotification model
        migrations.CreateModel(
            name='MenuNotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('menu_date', models.DateField()),
                ('menu_text', models.TextField()),
                ('meal_type', models.CharField(
                    choices=[('breakfast', 'Breakfast'), ('lunch', 'Lunch'), ('dinner', 'Dinner'), ('snacks', 'Snacks')],
                    max_length=20
                )),
                ('status', models.CharField(
                    choices=[('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')],
                    default='draft',
                    max_length=20
                )),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='menu_notifications_created', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-menu_date', '-created_at'],
            },
        ),
        
        # Add indexes to Meal model
        migrations.AddIndex(
            model_name='meal',
            index=models.Index(fields=['menu_posted'], name='meals_menu_posted_idx'),
        ),
        
        # Add indexes to MenuNotification model
        migrations.AddIndex(
            model_name='menunotification',
            index=models.Index(fields=['-menu_date', 'status'], name='menu_date_status_idx'),
        ),
        
        # Add indexes to MealFeedback model
        migrations.AddIndex(
            model_name='mealfeedback',
            index=models.Index(fields=['meal', 'feedback_type'], name='meal_feedback_type_idx'),
        ),
        migrations.AddIndex(
            model_name='mealfeedback',
            index=models.Index(fields=['is_published_by_hr'], name='feedback_published_idx'),
        ),
    ]
