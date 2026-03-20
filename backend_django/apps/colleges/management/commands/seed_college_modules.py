"""Management command: seed default CollegeModuleConfig rows.

Creates an enabled config row for every known module for every college
that doesn't already have one.  Safe to run multiple times (idempotent).

Usage:
    python manage.py seed_college_modules
    python manage.py seed_college_modules --college COLLEGE_CODE
    python manage.py seed_college_modules --disable sports --college DEMO
"""

from django.core.management.base import BaseCommand

# All module slugs from core.rbac
ALL_MODULES = [
    'hostel', 'sports', 'hall', 'fees', 'gatepass',
    'notices', 'meals', 'security', 'reports', 'complaints', 'notifications',
]


class Command(BaseCommand):
    help = 'Seed default CollegeModuleConfig rows for all colleges.'

    def add_arguments(self, parser):
        parser.add_argument('--college', type=str, default=None, help='Limit to a specific college code.')
        parser.add_argument('--disable', type=str, default=None, help='Module to disable (others stay enabled).')

    def handle(self, *args, **options):
        from apps.colleges.models import College, CollegeModuleConfig

        qs = College.objects.all()
        if options['college']:
            qs = qs.filter(code=options['college'])

        disable_module = options.get('disable')
        created_total = 0

        for college in qs:
            for module in ALL_MODULES:
                is_enabled = not (disable_module and module == disable_module)
                _, created = CollegeModuleConfig.objects.get_or_create(
                    college=college,
                    module_name=module,
                    defaults={'is_enabled': is_enabled},
                )
                if created:
                    created_total += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. Created {created_total} new CollegeModuleConfig rows.'
            )
        )
