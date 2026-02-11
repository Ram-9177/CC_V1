from django.core.management.base import BaseCommand
from apps.auth.models import User
from django.contrib.auth.models import Group

class Command(BaseCommand):
    help = 'Seed test users for all roles'

    def handle(self, *args, **options):
        # Create Groups
        roles = {
            'student': 'Student',
            'warden': 'Warden',
            'head_warden': 'Head Warden',
            'admin': 'Admin',
            'super_admin': 'Admin',
            'gate_security': 'Gate Security',
            'security_head': 'Security Head',
            'chef': 'Chef',
            'staff': 'Staff'
        }
        for group_name in roles.values():
            Group.objects.get_or_create(name=group_name)

        # Users to create
        users = [
            # (Username, Password, Role)
            ('ADMIN', 'password123', 'super_admin'),
            ('WARDEN', 'password123', 'warden'),
            ('HEADWARDEN', 'password123', 'head_warden'),
            ('SECURITY', 'password123', 'gate_security'),
            ('CHEF', 'password123', 'chef'),
            ('STUDENT1', 'password123', 'student'),
            ('STUDENT2', 'password123', 'student'),
        ]

        for username, password, role in users:
            try:
                user = User.objects.create_user(
                    username=username,
                    email=f'{username.lower()}@example.com',
                    password=password,
                    role=role,
                    registration_number=username if role == 'student' else None
                )
                
                # Assign Group
                group_name = roles.get(role)
                if group_name:
                    group = Group.objects.get(name=group_name)
                    user.groups.add(group)

                # Special setup for Students (Tenant profile)
                if role == 'student':
                    from apps.users.models import Tenant
                    Tenant.objects.get_or_create(
                        user=user,
                        defaults={
                            'father_name': 'Parent Of ' + username,
                            'father_phone': '9999999999',
                            'college_code': 'SMG001'
                        }
                    )
                
                self.stdout.write(self.style.SUCCESS(f'Created {role}: {username}'))

            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Skipped {username}: {str(e)}'))
