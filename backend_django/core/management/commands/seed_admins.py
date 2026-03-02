"""
Management command to seed default admin users on production.

Usage:
    python manage.py seed_admins

This is idempotent — safe to run multiple times. It will:
  - Create users if they don't exist
  - Update passwords if they already exist
"""

from django.core.management.base import BaseCommand
from apps.auth.models import User


class Command(BaseCommand):
    help = 'Create or update default SUPERADMIN and ADMIN accounts'

    def handle(self, *args, **options):
        admins = [
            {
                'username': 'SUPERADMIN',
                'email': 'superadmin@smg.in',
                'first_name': 'Super',
                'last_name': 'Admin',
                'role': 'super_admin',
                'is_staff': True,
                'is_superuser': True,
                'registration_number': 'SA-001',
                'password': 'Ram@9177',
            },
            {
                'username': 'ADMIN',
                'email': 'admin@smg.in',
                'first_name': 'Admin',
                'last_name': 'User',
                'role': 'admin',
                'is_staff': True,
                'is_superuser': False,
                'registration_number': 'AD-001',
                'password': 'Ram@9177',
            },
        ]

        for data in admins:
            password = data.pop('password')
            user, created = User.objects.update_or_create(
                username=data['username'],
                defaults=data,
            )
            user.set_password(password)
            user.save()

            status = 'CREATED' if created else 'UPDATED'
            self.stdout.write(self.style.SUCCESS(
                f'  ✅ {user.username} ({user.role}) — {status}'
            ))

        self.stdout.write(self.style.SUCCESS('\nAdmin seeding complete.'))
