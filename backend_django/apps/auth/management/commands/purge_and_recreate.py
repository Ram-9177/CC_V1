
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
    help = 'Clears all data and creates role-based test users.'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Force reset without confirmation')

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

            self.stdout.write('Creating users...')
            password = 'password123'
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
                    is_superuser=True if role == 'super_admin' else False
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
                password=password
            )
            Tenant.objects.update_or_create(
                user=student,
                defaults={
                    'father_name': 'Father Name',
                    'father_phone': '9876543210',
                    'address': 'Test Address',
                    'college_code': 'SMRU'
                }
            )
            self.stdout.write(f'Created student: {student_username}')

            # College
            College.objects.create(name='SMRU College', code='SMRU')
            self.stdout.write('Created default college: SMRU')

        self.stdout.write(self.style.SUCCESS('Reset complete.'))
