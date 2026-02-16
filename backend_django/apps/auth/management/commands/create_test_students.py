from django.core.management.base import BaseCommand
from apps.auth.models import User
from apps.users.models import Tenant

class Command(BaseCommand):
    help = 'Create 10 test students: student1 to student10'

    def handle(self, *args, **kwargs):
        for i in range(1, 11):
            username = f'student{i}'
            reg_no = f'STU_REG_{i}'
            password = 'password123'
            email = f'student{i}@example.com'
            
            # Use registration_number as unique identifier for this script
            # to avoid conflicts if previously run with different usernames
            user, created = User.objects.get_or_create(
                username=username.upper(),
                defaults={
                    'registration_number': reg_no,
                    'email': email,
                    'role': 'student',
                    'first_name': 'Student',
                    'last_name': str(i),
                }
            )
            
            if created:
                user.set_password(password)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Created user: {user.username}"))
                
                # Create Tenant record
                Tenant.objects.get_or_create(
                    user=user,
                    defaults={
                        'college_code': 'ENG',
                        'father_name': f'Father {i}',
                        'father_phone': f'999999990{i}',
                    }
                )
            else:
                self.stdout.write(self.style.WARNING(f"User {user.username} already exists"))
