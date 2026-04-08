"""Management command: seed_bulk_students
Creates additional student accounts for load and integration testing.

This command is additive and non-destructive. It creates new student users
with deterministic usernames and registration numbers and never deletes data.

Usage:
    python manage.py seed_bulk_students --college-code SMG --count 100
    python manage.py seed_bulk_students --college-code SMG --count 250 --prefix LOADSTUD
"""

from __future__ import annotations

import re

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.auth.models import User
from apps.colleges.models import College

DEFAULT_PASSWORD = "Test@1234"
DEFAULT_PREFIX = "LOADSTUD"
DEPARTMENTS = ["CSE", "ECE", "EEE", "MECH", "CIVIL", "MBA", "BBA"]


class Command(BaseCommand):
    help = "Create additive bulk student users for medium/heavy test datasets."

    def add_arguments(self, parser):
        parser.add_argument(
            "--college-code",
            type=str,
            default="SMG",
            help="College code where students will be created (default: SMG)",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=100,
            help="Number of students to create (default: 100)",
        )
        parser.add_argument(
            "--prefix",
            type=str,
            default=DEFAULT_PREFIX,
            help=f"Username prefix (default: {DEFAULT_PREFIX})",
        )
        parser.add_argument(
            "--password",
            type=str,
            default=DEFAULT_PASSWORD,
            help=f"Password for seeded users (default: {DEFAULT_PASSWORD})",
        )
        parser.add_argument(
            "--hosteller-ratio",
            type=int,
            default=85,
            help="Percentage of users marked hosteller (0-100, default: 85)",
        )

    def handle(self, *args, **options):
        college_code = str(options["college_code"]).strip()
        count = int(options["count"])
        prefix = str(options["prefix"]).strip().upper()
        password = str(options["password"])
        hosteller_ratio = int(options["hosteller_ratio"])

        if count < 1:
            raise CommandError("--count must be at least 1")
        if not prefix or not re.fullmatch(r"[A-Z0-9_]+", prefix):
            raise CommandError("--prefix must contain only A-Z, 0-9, and underscore")
        if not 0 <= hosteller_ratio <= 100:
            raise CommandError("--hosteller-ratio must be between 0 and 100")

        try:
            college = College.objects.get(code=college_code)
        except College.DoesNotExist as exc:
            raise CommandError(
                f"College '{college_code}' not found. Create/seed college first."
            ) from exc

        # Determine next running index from existing usernames with the same prefix.
        pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
        existing_usernames = User.objects.filter(username__startswith=prefix).values_list(
            "username", flat=True
        )
        max_index = 0
        for username in existing_usernames:
            match = pattern.match((username or "").upper())
            if not match:
                continue
            max_index = max(max_index, int(match.group(1)))

        start_index = max_index + 1
        hosteller_count = round(count * (hosteller_ratio / 100.0))
        encoded_password = make_password(password)

        to_create: list[User] = []
        for offset in range(count):
            n = start_index + offset
            username = f"{prefix}{n:05d}"
            reg_no = f"REG-{prefix}{n:05d}"
            student_type = "hosteller" if offset < hosteller_count else "day_scholar"
            year = (offset % 4) + 1
            semester = min(8, (year * 2) - (offset % 2))
            department = DEPARTMENTS[offset % len(DEPARTMENTS)]

            to_create.append(
                User(
                    username=username,
                    first_name="Load",
                    last_name=f"Student{n:05d}",
                    email=f"{username.lower()}@campuscore.test",
                    role="student",
                    registration_number=reg_no,
                    student_type=student_type,
                    department=department,
                    year=year,
                    semester=semester,
                    is_active=True,
                    is_approved=True,
                    is_password_changed=True,
                    college=college,
                    password=encoded_password,
                )
            )

        with transaction.atomic():
            created = User.objects.bulk_create(to_create, batch_size=500)

        created_count = len(created)
        self.stdout.write("\n" + "=" * 70)
        self.stdout.write(
            self.style.SUCCESS(
                f"Created {created_count} student users for college {college.code} ({college.name})"
            )
        )
        self.stdout.write(
            f"Username range: {prefix}{start_index:05d} .. {prefix}{(start_index + created_count - 1):05d}"
        )
        self.stdout.write(f"Hosteller ratio applied: {hosteller_ratio}%")
        self.stdout.write(f"Password for seeded users: {password}")
        self.stdout.write("=" * 70 + "\n")
