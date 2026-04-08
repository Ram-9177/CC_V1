"""
Management command: seed_test_users
Creates one test account for every role in the system.
Safe to run multiple times — uses get_or_create.

Usage:
    python manage.py seed_test_users
    python manage.py seed_test_users --college-code ENG101
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from apps.auth.models import User

PASSWORD = "Test@1234"

TEST_USERS = [
    # (username,           role,            first_name,    last_name,   reg_no,           student_type)
    ("SUPERADMIN",         "super_admin",   "Super",       "Admin",     "REG-SUPERADMIN",  "hosteller"),
    ("TEST_ADMIN",         "admin",         "Test",        "Admin",     "REG-ADMIN",       "hosteller"),
    ("TEST_PRINCIPAL",     "principal",     "Test",        "Principal", "REG-PRINCIPAL",   "hosteller"),
    ("TEST_DIRECTOR",      "director",      "Test",        "Director",  "REG-DIRECTOR",    "hosteller"),
    ("TEST_HOD",           "hod",           "Test",        "HOD",       "REG-HOD",         "hosteller"),
    ("TEST_HEAD_WARDEN",   "head_warden",   "Test",        "HeadWarden","REG-HEADWARDEN",  "hosteller"),
    ("TEST_WARDEN",        "warden",        "Test",        "Warden",    "REG-WARDEN",      "hosteller"),
    ("TEST_INCHARGE",      "incharge",      "Test",        "Incharge",  "REG-INCHARGE",    "hosteller"),
    ("TEST_HEAD_CHEF",     "head_chef",     "Test",        "HeadChef",  "REG-HEADCHEF",    "hosteller"),
    ("TEST_CHEF",          "chef",          "Test",        "Chef",      "REG-CHEF",        "hosteller"),
    ("TEST_SECURITY_HEAD", "security_head", "Test",        "SecHead",   "REG-SECHEAD",     "hosteller"),
    ("TEST_GATE_SECURITY", "gate_security", "Test",        "GateSec",   "REG-GATESEC",     "hosteller"),
    ("TEST_HR",            "hr",            "Test",        "HR",        "REG-HR",          "hosteller"),
    ("TEST_PD",            "pd",            "Test",        "PhysDir",   "REG-PD",          "hosteller"),
    ("TEST_PT",            "pt",            "Test",        "PhysTrain", "REG-PT",          "hosteller"),
    ("TEST_STAFF",         "staff",         "Test",        "Staff",     "REG-STAFF",       "hosteller"),
    ("TEST_STUDENT",       "student",       "Test",        "Student",   "REG-STUDENT",     "hosteller"),
    ("TEST_DAY_SCHOLAR",   "student",       "Test",        "DayScholar","REG-DAYSCHOLAR",  "day_scholar"),
]


class Command(BaseCommand):
    help = "Seed one test user per role for development/testing."

    def add_arguments(self, parser):
        parser.add_argument(
            '--college-code',
            type=str,
            default=None,
            help='Assign all users to this college code (optional)',
        )

    def handle(self, *args, **options):
        college = None
        college_code = options.get('college_code')
        if college_code:
            try:
                from apps.colleges.models import College
                college = College.objects.get(code=college_code)
                self.stdout.write(f"Assigning users to college: {college.name}")
            except Exception:
                self.stdout.write(self.style.WARNING(f"College '{college_code}' not found — skipping college assignment."))

        created_count = 0
        updated_count = 0

        self.stdout.write("\n" + "="*60)
        self.stdout.write(f"{'USERNAME':<22} {'ROLE':<16} {'STATUS'}")
        self.stdout.write("="*60)

        for username, role, first, last, reg_no, student_type in TEST_USERS:
            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'first_name': first,
                    'last_name': last,
                    'email': f"{username.lower()}@campuscore.test",
                    'role': role,
                    'registration_number': reg_no,
                    'student_type': student_type,
                    'is_active': True,
                    'is_approved': True,
                    'is_password_changed': True,
                    'password': make_password(PASSWORD),
                    'college': college,
                }
            )

            if not created:
                # Update password and ensure active on re-run
                user.set_password(PASSWORD)
                user.is_active = True
                user.is_approved = True
                user.is_password_changed = True
                if college:
                    user.college = college
                user.save(update_fields=['password', 'is_active', 'is_approved', 'is_password_changed', 'college'])
                updated_count += 1
                status = self.style.WARNING("updated")
            else:
                # Superadmin needs extra flags
                if role == 'super_admin':
                    user.is_superuser = True
                    user.is_staff = True
                    user.save(update_fields=['is_superuser', 'is_staff'])
                created_count += 1
                status = self.style.SUCCESS("created")

            self.stdout.write(f"{username:<22} {role:<16} {status}")

        self.stdout.write("="*60)
        self.stdout.write(
            self.style.SUCCESS(f"\nDone. {created_count} created, {updated_count} updated.")
        )
        self.stdout.write(f"\nPassword for ALL accounts: {self.style.WARNING(PASSWORD)}\n")

        # Print credential table
        self.stdout.write("\n" + "="*60)
        self.stdout.write("FULL CREDENTIALS TABLE")
        self.stdout.write("="*60)
        self.stdout.write(f"{'USERNAME':<22} {'PASSWORD':<14} {'ROLE'}")
        self.stdout.write("-"*60)
        for username, role, *_ in TEST_USERS:
            self.stdout.write(f"{username:<22} {PASSWORD:<14} {role}")
        self.stdout.write("="*60 + "\n")
