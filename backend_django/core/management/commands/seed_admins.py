"""
Management command to seed default admin users on production.

Usage:
        python manage.py seed_admins --superadmin-password '...' --admin-password '...'

This is idempotent — safe to run multiple times. It will:
  - Create users if they don't exist
    - Update metadata if they already exist
    - Reset passwords only when explicitly requested
"""

import os

from django.core.management.base import BaseCommand, CommandError
from apps.auth.models import User


class Command(BaseCommand):
    help = 'Create or update default SUPERADMIN and ADMIN accounts'

    def add_arguments(self, parser):
        parser.add_argument(
            '--superadmin-password',
            default=os.environ.get('SUPERADMIN_PASSWORD', ''),
            help='Password for the SUPERADMIN account. Defaults to SUPERADMIN_PASSWORD env var.',
        )
        parser.add_argument(
            '--admin-password',
            default=os.environ.get('ADMIN_PASSWORD', ''),
            help='Password for the ADMIN account. Defaults to ADMIN_PASSWORD env var.',
        )
        parser.add_argument(
            '--reset-passwords',
            action='store_true',
            help='Reset passwords for existing admin accounts as well.',
        )

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
            },
        ]

        password_map = {
            'SUPERADMIN': options['superadmin_password'],
            'ADMIN': options['admin_password'],
        }
        reset_passwords = options['reset_passwords']

        missing_passwords = []
        for data in admins:
            username = data['username']
            user_exists = User.objects.filter(username=username).exists()
            if (not user_exists or reset_passwords) and not password_map.get(username):
                missing_passwords.append(username)

        if missing_passwords:
            missing = ', '.join(missing_passwords)
            raise CommandError(
                f'Missing passwords for: {missing}. Supply them via CLI flags or environment variables.'
            )

        for data in admins:
            username = data['username']
            user, created = User.objects.get_or_create(
                username=username,
                defaults=data,
            )

            changed = created
            for field, value in data.items():
                if getattr(user, field) != value:
                    setattr(user, field, value)
                    changed = True

            if created or reset_passwords:
                user.set_password(password_map[username])
                changed = True

            if changed:
                user.save()

            if created:
                status = 'CREATED'
            elif changed:
                status = 'UPDATED'
            else:
                status = 'UNCHANGED'

            self.stdout.write(self.style.SUCCESS(
                f'  ✅ {user.username} ({user.role}) — {status}'
            ))

        if not reset_passwords:
            self.stdout.write(self.style.WARNING('Existing passwords were left unchanged. Use --reset-passwords to rotate them.'))

        self.stdout.write(self.style.SUCCESS('\nAdmin seeding complete.'))
