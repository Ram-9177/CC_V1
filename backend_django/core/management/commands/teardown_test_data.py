"""
Management command: teardown_test_data
Removes all test data seeded by seed_full_test_data.

Identifies seeded rows by trace_id in the UUID range 5eed0000-xxxx-....
Safe to run multiple times.

Usage:
    python manage.py teardown_test_data
    python manage.py teardown_test_data --dry-run
"""

import uuid
from django.core.management.base import BaseCommand
from django.db import transaction

SEED_PREFIX = "5eed0000"
# UUID range for seeded data
SEED_UUID_MIN = uuid.UUID("5eed0000-0000-0000-0000-000000000000")
SEED_UUID_MAX = uuid.UUID("5eed0000-ffff-ffff-ffff-ffffffffffff")


class Command(BaseCommand):
    help = "Remove all test data created by seed_full_test_data (identified by trace_id)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        # Order matters: delete children before parents to avoid FK errors.
        # Each entry: (label, model_path, filter_kwargs)
        targets = [
            # Notifications
            ("Notifications", "apps.notifications.models", "Notification"),
            # Messages
            ("BroadcastMessages", "apps.messages.models", "BroadcastMessage"),
            ("Messages", "apps.messages.models", "Message"),
            # Placements
            ("Applications", "apps.placements.models", "Application"),
            ("JobPostings", "apps.placements.models", "JobPosting"),
            ("Companies", "apps.placements.models", "Company"),
            # Disciplinary
            ("FineLedgerEntries", "apps.disciplinary.models", "FineLedgerEntry"),
            ("DisciplinaryActions", "apps.disciplinary.models", "DisciplinaryAction"),
            # Sports (new models don't have trace_id — skip or handle separately)
            # Hall Booking
            ("HallEquipmentBookings", "apps.hall_booking.models", "HallEquipmentBooking"),
            ("HallAttendance", "apps.hall_booking.models", "HallAttendance"),
            ("HallBookings", "apps.hall_booking.models", "HallBooking"),
            ("HallSlots", "apps.hall_booking.models", "HallSlot"),
            ("HallEquipment", "apps.hall_booking.models", "HallEquipment"),
            ("Halls", "apps.hall_booking.models", "Hall"),
            # Visitors
            ("VisitorLogs", "apps.visitors.models", "VisitorLog"),
            ("VisitorPreRegistrations", "apps.visitors.models", "VisitorPreRegistration"),
            # Complaints
            ("ComplaintUpdates", "apps.complaints.models", "ComplaintUpdate"),
            ("Complaints", "apps.complaints.models", "Complaint"),
            # Events
            ("EventRegistrations", "apps.events.models", "EventRegistration"),
            ("Events", "apps.events.models", "Event"),
            # Notices
            ("Notices", "apps.notices.models", "Notice"),
            # Meals
            ("MealFeedbackResponses", "apps.meals.models", "MealFeedbackResponse"),
            ("MealFeedback", "apps.meals.models", "MealFeedback"),
            ("MealAttendance", "apps.meals.models", "MealAttendance"),
            ("MealItems", "apps.meals.models", "MealItem"),
            ("MealWastage", "apps.meals.models", "MealWastage"),
            ("MenuNotifications", "apps.meals.models", "MenuNotification"),
            ("MealSpecialRequests", "apps.meals.models", "MealSpecialRequest"),
            ("MealPreferences", "apps.meals.models", "MealPreference"),
            ("Meals", "apps.meals.models", "Meal"),
            # Leaves
            ("LeaveApplications", "apps.leaves.models", "LeaveApplication"),
            # Gate Passes
            ("GateScans", "apps.gate_passes.models", "GateScan"),
            ("GatePasses", "apps.gate_passes.models", "GatePass"),
            # Attendance
            ("Attendance", "apps.attendance.models", "Attendance"),
            # Rooms (children first)
            ("RoomAllocations", "apps.rooms.models", "RoomAllocation"),
            ("Beds", "apps.rooms.models", "Bed"),
            ("Rooms", "apps.rooms.models", "Room"),
        ]

        self.stdout.write(f"\n{'='*60}")
        mode = "DRY RUN — " if dry_run else ""
        self.stdout.write(f"  {mode}TEARING DOWN TEST DATA (trace_id starts with '{SEED_PREFIX}')")
        self.stdout.write(f"{'='*60}\n")

        total = 0

        with transaction.atomic():
            for label, module_path, model_name in targets:
                try:
                    import importlib
                    mod = importlib.import_module(module_path)
                    Model = getattr(mod, model_name)
                except (ImportError, AttributeError) as e:
                    self.stdout.write(
                        self.style.WARNING(f"  ⚠️  {label}: skipped ({e})")
                    )
                    continue

                if not hasattr(Model, "trace_id"):
                    self.stdout.write(
                        self.style.WARNING(f"  ⚠️  {label}: no trace_id field, skipped")
                    )
                    continue

                qs = Model.objects.filter(
                    trace_id__gte=SEED_UUID_MIN, trace_id__lte=SEED_UUID_MAX
                )
                count = qs.count()

                if count == 0:
                    continue

                if not dry_run:
                    qs.delete()

                total += count
                self.stdout.write(
                    self.style.SUCCESS(f"  🗑️  {label}: {count} {'would be ' if dry_run else ''}deleted")
                )

            # Fix room occupancy counts after deleting allocations
            if not dry_run:
                try:
                    from apps.rooms.models import Room
                    from django.db.models import Count, Q

                    for room in Room.objects.filter(current_occupancy__gt=0):
                        actual = room.bed_set.filter(is_occupied=True).count()
                        if room.current_occupancy != actual:
                            room.current_occupancy = actual
                            room.save(update_fields=["current_occupancy"])
                except Exception:
                    pass

        self.stdout.write(f"\n{'='*60}")
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f"  DRY RUN complete. {total} records would be deleted.")
            )
            self.stdout.write("  Run without --dry-run to actually delete.")
        else:
            self.stdout.write(
                self.style.SUCCESS(f"  TEARDOWN complete. {total} records deleted.")
            )
        self.stdout.write(f"{'='*60}\n")
