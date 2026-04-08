import logging
import os

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from apps.auth.models import User
from apps.users.models import Tenant
from apps.colleges.models import College

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Creates the root accounts for all primary core roles in the system without deleting existing data.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--bootstrap-password',
            default=os.environ.get('CORE_ROLE_BOOTSTRAP_PASSWORD', ''),
            help='Password for newly created core role accounts. Defaults to CORE_ROLE_BOOTSTRAP_PASSWORD.',
        )
        parser.add_argument(
            '--reset-existing-passwords',
            action='store_true',
            help='Also reset passwords for existing core role accounts.',
        )
        parser.add_argument(
            '--include-demo-student',
            action='store_true',
            help='Create or update the demo student account as well.',
        )

    def handle(self, *args, **options):
        password = options['bootstrap_password']
        reset_existing_passwords = options['reset_existing_passwords']
        include_demo_student = options['include_demo_student']
        roles = [
            ('super_admin', 'SUPERADMIN', 'Super', 'Admin'),
            ('admin', 'ADMIN', 'System', 'Admin'),
            ('head_warden', 'HEADWARDEN', 'Head', 'Warden'),
            ('warden', 'WARDEN_USER', 'Hostel', 'Warden'),
            ('staff', 'STAFF_USER', 'Staff', 'Member'),
            ('chef', 'CHEF_USER', 'Mess', 'Chef'),
            ('head_chef', 'HEADCHEF_USER', 'Head', 'Chef'),
            ('security_head', 'SECURITYHEAD', 'Security', 'Head'),
            ('gate_security', 'GATESECURITY', 'Gate', 'Security'),
        ]

        missing_password_targets = []
        for _, username, _, _ in roles:
            user_exists = User.objects.filter(username=username).exists()
            if (not user_exists or reset_existing_passwords) and not password:
                missing_password_targets.append(username)

        if include_demo_student:
            student_exists = User.objects.filter(username='2024TEST001').exists()
            if (not student_exists or reset_existing_passwords) and not password:
                missing_password_targets.append('2024TEST001')

        if missing_password_targets:
            missing = ', '.join(missing_password_targets)
            raise CommandError(
                f'A bootstrap password is required for: {missing}. Supply --bootstrap-password or CORE_ROLE_BOOTSTRAP_PASSWORD.'
            )

        with transaction.atomic():
            self.stdout.write('Checking and configuring primary core role accounts...')
            
            # Ensure default college exists for students
            college, _ = College.objects.get_or_create(code='SMG', defaults={'name': 'SMG CampusCore Campus'})

            # Ensure default building exists for rooms
            from apps.rooms.models import Building
            building, b_created = Building.objects.get_or_create(
                code='MAIN', 
                defaults={'name': 'Main Block', 'total_floors': 4}
            )
            if b_created:
                self.stdout.write(self.style.SUCCESS(f'Created default building: {building.name}'))

            created_count = 0
            for role, username, first, last in roles:
                user, created = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'first_name': first,
                        'last_name': last,
                        'role': role,
                        'is_staff': role in ['admin', 'super_admin'],
                        'is_superuser': role == 'super_admin',
                        'is_password_changed': True,
                        'registration_number': username,
                        'email': f"{username.lower()}@demo.local"
                    }
                )
                changed = created

                if user.is_active is not True:
                    user.is_active = True
                    changed = True

                if created:
                    user.set_password(password)
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(f'Created {role}: {username}'))
                else:
                    desired_fields = {
                        'first_name': first,
                        'last_name': last,
                        'role': role,
                        'is_staff': role in ['admin', 'super_admin'],
                        'is_superuser': role == 'super_admin',
                        'is_password_changed': True,
                        'registration_number': username,
                        'email': f"{username.lower()}@demo.local",
                    }
                    for field, value in desired_fields.items():
                        if getattr(user, field) != value:
                            setattr(user, field, value)
                            changed = True

                    if reset_existing_passwords:
                        user.set_password(password)
                        changed = True

                    self.stdout.write(f'{role} already exists: {username} (metadata synchronized)')

                if changed:
                    user.save()

            if include_demo_student:
                student_username = '2024TEST001'
                student, created = User.objects.get_or_create(
                    username=student_username,
                    defaults={
                        'first_name': 'Test',
                        'last_name': 'Student',
                        'role': 'student',
                        'is_password_changed': True,
                        'registration_number': student_username,
                        'email': 'student@demo.local'
                    }
                )

                student_changed = created
                if created:
                    student.set_password(password)
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(f'Created student: {student_username}'))
                else:
                    if reset_existing_passwords:
                        student.set_password(password)
                        student_changed = True
                    self.stdout.write(f'Student already exists: {student_username}')

                if student_changed:
                    student.save()

                Tenant.objects.update_or_create(
                    user=student,
                    defaults={
                        'father_name': 'Parent Of Test',
                        'father_phone': '9876543210',
                        'address': 'Campus Student Housing',
                        'college_code': college.code
                    }
                )

            self.stdout.write(self.style.SUCCESS(f'\nFinished. Processed {created_count} core role accounts!'))
            if reset_existing_passwords:
                self.stdout.write(self.style.WARNING('Existing core role passwords were rotated because --reset-existing-passwords was supplied.'))
