
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.auth.models import User
from apps.users.models import Tenant
from apps.rooms.models import Building, Room, Bed, RoomAllocation
from apps.gate_passes.models import GatePass, GateScan as GatePassScan
from apps.gate_scans.models import GateScan as GateScanLog
from apps.attendance.models import Attendance
from apps.meals.models import Meal, MealItem, MealFeedback, MealAttendance, MealPreference
from apps.notices.models import Notice
from apps.events.models import Event, EventRegistration
from apps.notifications.models import Notification
from apps.metrics.models import Metric
from apps.reports.models import Report
from apps.colleges.models import College
from apps.messages.models import Message

class Command(BaseCommand):
    help = 'Clears all data and initializes the system. Use --clean for a production-ready state.'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Force reset without confirmation')
        parser.add_argument('--clean', action='store_true', help='Wipe all data and only create a single superadmin')

    def handle(self, *args, **options):
        if not options['force']:
            confirm = input("This will DELETE ALL DATA. Type 'YES' to confirm: ")
            if confirm != 'YES':
                self.stdout.write(self.style.WARNING('Aborted.'))
                return

        with transaction.atomic():
            self.stdout.write('Clearing data...')
            Message.objects.all().delete()
            Report.objects.all().delete()
            Metric.objects.all().delete()
            Notification.objects.all().delete()
            EventRegistration.objects.all().delete()
            Event.objects.all().delete()
            Notice.objects.all().delete()
            MealAttendance.objects.all().delete()
            MealFeedback.objects.all().delete()
            MealPreference.objects.all().delete()
            MealItem.objects.all().delete()
            Meal.objects.all().delete()
            Attendance.objects.all().delete()
            GateScanLog.objects.all().delete()
            GatePassScan.objects.all().delete()
            GatePass.objects.all().delete()
            RoomAllocation.objects.all().delete()
            Bed.objects.all().delete()
            Room.objects.all().delete()
            Building.objects.all().delete()
            College.objects.all().delete()
            Tenant.objects.all().delete()
            User.objects.all().delete()

            # Ensure default college exists
            college = College.objects.create(name='SMG CampusCore Campus', code='SMG')
            self.stdout.write(f'Created default campus: {college.name}')

            password = 'password123'
            
            if options['clean']:
                self.stdout.write('Initializing clean production state...')
                # Only create one super admin
                User.objects.create_superuser(
                    username='ADMIN',
                    registration_number='ADMIN',
                    first_name='System',
                    last_name='Administrator',
                    role='super_admin',
                    password=password,
                    is_password_changed=True
                )
                self.stdout.write(self.style.SUCCESS('System initialized with ADMIN / password123'))
            else:
                self.stdout.write('Creating dummy test users for all roles...')
                roles = [
                    ('super_admin', 'superadmin', 'Super', 'Admin'),
                    ('admin', 'admin_user', 'System', 'Admin'),
                    ('head_warden', 'headwarden', 'Head', 'Warden'),
                    ('warden', 'warden_user', 'Hostel', 'Warden'),
                    ('staff', 'staff_user', 'Staff', 'Member'),
                    ('chef', 'chef_user', 'Mess', 'Chef'),
                    ('security_head', 'securityhead', 'Security', 'Head'),
                    ('gate_security', 'gatesecurity', 'Gate', 'Security'),
                ]

                for role, username, first, last in roles:
                    User.objects.create_user(
                        username=username.upper(),
                        first_name=first,
                        last_name=last,
                        role=role,
                        password=password,
                        is_staff=True if role in ['admin', 'super_admin'] else False,
                        is_superuser=True if role == 'super_admin' else False,
                        is_password_changed=True
                    )
                    self.stdout.write(f'Created {role}: {username.upper()}')

                # Student
                student_username = '2024TEST001'
                student = User.objects.create_user(
                    username=student_username,
                    registration_number=student_username,
                    first_name='Test',
                    last_name='Student',
                    role='student',
                    password=password,
                    is_password_changed=True
                )
                Tenant.objects.update_or_create(
                    user=student,
                    defaults={
                        'father_name': 'Parent Of Test',
                        'father_phone': '9876543210',
                        'address': 'Campus Student Housing',
                        'college_code': 'SMG'
                    }
                )
                self.stdout.write(f'Created student: {student_username}')

        self.stdout.write(self.style.SUCCESS('Reset complete.'))
