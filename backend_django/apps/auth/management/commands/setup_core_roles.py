import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.auth.models import User
from apps.users.models import Tenant
from apps.colleges.models import College

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Creates the root accounts for all primary core roles in the system without deleting existing data.'

    def handle(self, *args, **options):
        with transaction.atomic():
            self.stdout.write('Checking and configuring primary core role accounts...')
            password = 'Ram@9177'
            
            # Ensure default college exists for students
            college, _ = College.objects.get_or_create(code='SMG', defaults={'name': 'SMG Hostel Campus'})

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
                if created:
                    user.set_password(password)
                    user.save()
                    self.stdout.write(self.style.SUCCESS(f'Created {role}: {username}'))
                    created_count += 1
                else:
                    user.set_password(password)
                    user.save()
                    self.stdout.write(f'{role} already exists: {username} (password forcefully reset)')

            # Default Development Student (If needed for testing in production)
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
            
            if created:
                student.set_password(password)
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
                self.stdout.write(self.style.SUCCESS(f'Created student: {student_username}'))
                created_count += 1
            else:
                self.stdout.write(f'Student already exists: {student_username}')

            self.stdout.write(self.style.SUCCESS(f'\nFinished. Processed {created_count} core role accounts!'))
            self.stdout.write(self.style.WARNING(f'Default access password set to: {password} (Please change this in the app later)'))
