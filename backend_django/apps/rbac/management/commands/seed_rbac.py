"""Management command: seed_rbac

Populates (or updates) the RBAC database tables with roles, modules,
permissions, and the default role→module→permission matrix.

Running this command is idempotent – it can be executed multiple times
without creating duplicate records.

Usage::

    python manage.py seed_rbac

"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.rbac.models import Module, Permission, Role, RolePermission

# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------

ROLES: list[tuple[str, str]] = [
    ('super_admin',   'Super Admin'),
    ('admin',         'Admin'),
    ('principal',     'Principal'),
    ('director',      'Director'),
    ('hod',           'HOD'),
    ('head_warden',   'Head Warden'),
    ('warden',        'Warden'),
    ('incharge',      'Incharge'),
    ('pd',            'Physical Director'),
    ('pt',            'Physical Trainer'),
    ('gate_security', 'Gate Security'),
    ('security_head', 'Security Head'),
    ('chef',          'Chef'),
    ('head_chef',     'Head Chef'),
    ('hr',            'HR Rep'),
    ('staff',         'Staff'),
    ('student',       'Student'),
]

MODULES: list[tuple[str, str]] = [
    ('hostel',   'Hostel'),
    ('sports',   'Sports'),
    ('hall',     'Hall'),
    ('fees',     'Fees'),
    ('gatepass', 'Gatepass'),
    ('notices',  'Notices'),
    ('meals',    'Meals'),
    ('security', 'Security'),
    ('reports',  'Reports'),
    ('complaints', 'Complaints'),
    ('notifications', 'Notifications'),
]

PERMISSIONS: list[tuple[str, str, str]] = [
    # (slug, name, description)
    ('none',                    'No Access',            'No access to this module'),
    ('view',                    'View Only',            'Read-only access'),
    ('limited',                 'Limited View',         'Restricted read-only (own data only)'),
    ('request',                 'Request',              'Can submit requests'),
    ('participate',             'Participate',          'Can register/participate in activities'),
    ('apply_for_class_branch',  'Apply Class/Branch',   'Can apply events for an entire class or branch'),
    ('assist_verify',           'Assist & Verify',      'Can assist with and verify activities'),
    ('partial',                 'Partial Access',       'View + limited management of assigned scope'),
    ('create',                  'Create',               'Can create new records'),
    ('approve',                 'Approve',              'Can approve pending items'),
    ('verify_entry_exit',       'Verify Entry/Exit',    'Can scan and verify gate entry/exit'),
    ('broadcast',               'Broadcast',            'Can publish notices to all audiences'),
    ('department_notices',      'Department Notices',   'Can publish scoped department notices'),
    ('hostel_notices',          'Hostel Notices',       'Can publish scoped hostel notices'),
    ('sports_notices',          'Sports Notices',       'Can publish sports-related notices'),
    ('reports',                 'Reports',              'Can view and export reports'),
    ('manage',                  'Manage',               'Full CRUD + approve + verify on this module'),
    ('full_control',            'Full Control',         'Manage + additional sports authority'),
    ('full',                    'Full Access',          'Unrestricted access including reports'),
]

# Default role → module → permission-level matrix.
# Keys must be slugs defined in ROLES and MODULES above.
ROLE_MODULE_MATRIX: dict[str, dict[str, str]] = {
    'super_admin': {
        'hostel': 'full', 'sports': 'full', 'hall': 'full',
        'fees': 'full', 'gatepass': 'full', 'notices': 'full',
        'meals': 'full', 'security': 'full', 'reports': 'full',
        'complaints': 'full', 'notifications': 'full',
    },
    'admin': {
        'hostel': 'full', 'sports': 'full', 'hall': 'full',
        'fees': 'full', 'gatepass': 'full', 'notices': 'full',
        'meals': 'full', 'security': 'full', 'reports': 'full',
        'complaints': 'full', 'notifications': 'full',
    },
    'principal': {
        'hostel': 'view', 'sports': 'view', 'hall': 'manage',
        'fees': 'reports', 'gatepass': 'view', 'notices': 'broadcast',
        'meals': 'view', 'security': 'view', 'reports': 'view',
        'complaints': 'view', 'notifications': 'view',
    },
    'director': {
        'hostel': 'view', 'sports': 'view', 'hall': 'manage',
        'fees': 'view', 'gatepass': 'view', 'notices': 'broadcast',
        'meals': 'view', 'security': 'view', 'reports': 'view',
        'complaints': 'view', 'notifications': 'view',
    },
    'hod': {
        'hostel': 'none', 'sports': 'apply_for_class_branch', 'hall': 'request',
        'fees': 'view', 'gatepass': 'none', 'notices': 'department_notices',
        'meals': 'view', 'security': 'none', 'reports': 'view',
        'complaints': 'view', 'notifications': 'view',
    },
    'head_warden': {
        'hostel': 'manage', 'sports': 'none', 'hall': 'none',
        'fees': 'view', 'gatepass': 'approve', 'notices': 'manage',
        'meals': 'manage', 'security': 'view', 'reports': 'view',
        'complaints': 'manage', 'notifications': 'view',
    },
    'warden': {
        'hostel': 'manage', 'sports': 'none', 'hall': 'none',
        'fees': 'none', 'gatepass': 'approve', 'notices': 'hostel_notices',
        'meals': 'view', 'security': 'view', 'reports': 'view',
        'complaints': 'manage', 'notifications': 'view',
    },
    'incharge': {
        'hostel': 'partial', 'sports': 'partial', 'hall': 'none',
        'fees': 'none', 'gatepass': 'partial', 'notices': 'create',
        'meals': 'view', 'security': 'none', 'reports': 'view',
        'complaints': 'view', 'notifications': 'view',
    },
    'pd': {
        'hostel': 'none', 'sports': 'full_control', 'hall': 'manage',
        'fees': 'none', 'gatepass': 'none', 'notices': 'sports_notices',
        'meals': 'none', 'security': 'none', 'reports': 'view',
        'complaints': 'none', 'notifications': 'view',
    },
    'pt': {
        'hostel': 'none', 'sports': 'assist_verify', 'hall': 'none',
        'fees': 'none', 'gatepass': 'none', 'notices': 'none',
        'meals': 'none', 'security': 'none', 'reports': 'view',
        'complaints': 'none', 'notifications': 'view',
    },
    'gate_security': {
        'hostel': 'none', 'sports': 'none', 'hall': 'none',
        'fees': 'none', 'gatepass': 'verify_entry_exit', 'notices': 'none',
        'meals': 'none', 'security': 'manage', 'reports': 'none',
        'complaints': 'none', 'notifications': 'view',
    },
    'security_head': {
        'hostel': 'none', 'sports': 'none', 'hall': 'none',
        'fees': 'none', 'gatepass': 'verify_entry_exit', 'notices': 'none',
        'meals': 'none', 'security': 'manage', 'reports': 'view',
        'complaints': 'view', 'notifications': 'view',
    },
    'chef': {
        'hostel': 'none', 'sports': 'none', 'hall': 'none',
        'fees': 'none', 'gatepass': 'none', 'notices': 'none',
        'meals': 'manage', 'security': 'none', 'reports': 'none',
        'complaints': 'view', 'notifications': 'view',
    },
    'head_chef': {
        'hostel': 'none', 'sports': 'none', 'hall': 'none',
        'fees': 'none', 'gatepass': 'none', 'notices': 'none',
        'meals': 'manage', 'security': 'none', 'reports': 'none',
        'complaints': 'view', 'notifications': 'view',
    },
    'hr': {
        'hostel': 'manage', 'sports': 'none', 'hall': 'none',
        'fees': 'view', 'gatepass': 'approve', 'notices': 'create',
        'meals': 'view', 'security': 'view', 'reports': 'view',
        'complaints': 'manage', 'notifications': 'view',
    },
    'staff': {
        'hostel': 'none', 'sports': 'none', 'hall': 'none',
        'fees': 'none', 'gatepass': 'none', 'notices': 'view',
        'meals': 'none', 'security': 'none', 'reports': 'none',
        'complaints': 'none', 'notifications': 'view',
    },
    'student': {
        'hostel': 'limited', 'sports': 'participate', 'hall': 'none',
        'fees': 'view', 'gatepass': 'request', 'notices': 'view',
        'meals': 'view', 'security': 'none', 'reports': 'none',
        'complaints': 'create', 'notifications': 'view',
    },
}


class Command(BaseCommand):
    help = (
        'Seed the RBAC database with roles, modules, permissions, and '
        'the default role-module permission matrix.  Idempotent.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Overwrite existing RolePermission records even if they already exist.',
        )

    def handle(self, *args, **options):
        force = options['force']

        # ── 1. Roles ─────────────────────────────────────────────────────────
        self.stdout.write('Seeding roles …')
        role_map: dict[str, Role] = {}
        for slug, name in ROLES:
            obj, created = Role.objects.get_or_create(slug=slug, defaults={'name': name})
            if not created and obj.name != name:
                obj.name = name
                obj.save(update_fields=['name'])
            role_map[slug] = obj
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(ROLES)} roles'))

        # ── 2. Modules ────────────────────────────────────────────────────────
        self.stdout.write('Seeding modules …')
        module_map: dict[str, Module] = {}
        for slug, name in MODULES:
            obj, created = Module.objects.get_or_create(slug=slug, defaults={'name': name})
            if not created and obj.name != name:
                obj.name = name
                obj.save(update_fields=['name'])
            module_map[slug] = obj
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(MODULES)} modules'))

        # ── 3. Permissions ────────────────────────────────────────────────────
        self.stdout.write('Seeding permissions …')
        perm_map: dict[str, Permission] = {}
        for slug, name, description in PERMISSIONS:
            obj, created = Permission.objects.get_or_create(
                slug=slug, defaults={'name': name, 'description': description}
            )
            if not created:
                changed = False
                if obj.name != name:
                    obj.name = name
                    changed = True
                if obj.description != description:
                    obj.description = description
                    changed = True
                if changed:
                    obj.save(update_fields=['name', 'description'])
            perm_map[slug] = obj
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(PERMISSIONS)} permissions'))

        # ── 4. RolePermissions ────────────────────────────────────────────────
        self.stdout.write('Assigning role-module permissions …')
        created_count = updated_count = skipped_count = 0

        for role_slug, module_perms in ROLE_MODULE_MATRIX.items():
            role_obj = role_map.get(role_slug)
            if not role_obj:
                self.stderr.write(f'  ⚠ Role not found: {role_slug}')
                continue

            for module_slug, perm_slug in module_perms.items():
                module_obj = module_map.get(module_slug)
                perm_obj = perm_map.get(perm_slug)
                if not module_obj or not perm_obj:
                    self.stderr.write(
                        f'  ⚠ Missing module/perm: {module_slug}/{perm_slug}'
                    )
                    continue

                rp, created = RolePermission.objects.get_or_create(
                    role=role_obj,
                    module=module_obj,
                    defaults={'permission': perm_obj},
                )
                if created:
                    created_count += 1
                elif rp.permission != perm_obj:
                    if force:
                        rp.permission = perm_obj
                        rp.save(update_fields=['permission'])
                        updated_count += 1
                    else:
                        skipped_count += 1

        summary = f'  ✓ created={created_count}  updated={updated_count}  skipped={skipped_count}'
        if skipped_count:
            summary += '  (use --force to overwrite existing assignments)'
        self.stdout.write(self.style.SUCCESS(summary))
        self.stdout.write(self.style.SUCCESS('RBAC seed complete.'))
