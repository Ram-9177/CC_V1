"""
Management command: seed_full_test_data
Seeds realistic test data across ALL features and roles.

Usage:
    python manage.py seed_full_test_data
    python manage.py seed_full_test_data --college-code SMG

All seeded records use trace_id starting with "seed-" so they can be
identified and cleaned up later with `teardown_test_data`.
"""

import uuid
import random
from datetime import date, time, timedelta, datetime
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

SEED_PREFIX = "5eed0000"


def seed_trace():
    """Generate a UUID trace_id that marks this row as seeded (starts with 5eed0000-)."""
    tail = uuid.uuid4().hex[8:]
    return uuid.UUID(f"5eed0000-{tail[:4]}-{tail[4:8]}-{tail[8:12]}-{tail[12:20]}0000")


class Command(BaseCommand):
    help = "Seed comprehensive test data for every feature and role."

    def add_arguments(self, parser):
        parser.add_argument(
            "--college-code",
            type=str,
            default="SMG",
            help="College code to scope test data (default: SMG)",
        )
        parser.add_argument(
            "--student-count",
            type=int,
            default=20,
            help="Number of students to include in seeding context (default: 20)",
        )
        parser.add_argument(
            "--random-seed",
            type=int,
            default=42,
            help="Deterministic random seed for reproducible seeded values (default: 42)",
        )

    def _scoped_users(self, college, role_filters, limit):
        """Pick active users with college-priority and graceful fallback."""
        if limit <= 0:
            return []

        from apps.auth.models import User

        if isinstance(role_filters, str):
            role_filters = [role_filters]

        base_qs = User.objects.filter(role__in=role_filters, is_active=True).order_by("id")

        scoped = list(base_qs.filter(college=college)[:limit])
        if len(scoped) >= limit:
            return scoped

        needed = limit - len(scoped)
        scoped_ids = [u.id for u in scoped]
        fallback = list(base_qs.exclude(id__in=scoped_ids)[:needed])
        scoped.extend(fallback)
        return scoped

    def handle(self, *args, **options):
        from apps.colleges.models import College

        college_code = options["college_code"]
        student_count = options["student_count"]
        random_seed = options["random_seed"]

        if student_count < 1:
            raise CommandError("--student-count must be at least 1")

        if random_seed is not None:
            random.seed(random_seed)

        try:
            college = College.objects.get(code=college_code)
        except College.DoesNotExist:
            self.stderr.write(
                self.style.ERROR(f"College '{college_code}' not found. Run setup_core_roles first.")
            )
            return

        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(f"  SEEDING FULL TEST DATA for {college.name}")
        self.stdout.write(f"{'='*60}\n")

        with transaction.atomic():
            ctx = {"college": college}

            # Gather users by role
            ctx["students"] = self._scoped_users(college, ["student"], student_count)
            ctx["wardens"] = self._scoped_users(college, ["warden", "head_warden"], 5)
            ctx["chefs"] = self._scoped_users(college, ["chef", "head_chef"], 3)
            ctx["security"] = self._scoped_users(college, ["gate_security", "security_head"], 3)
            ctx["staff"] = self._scoped_users(college, ["staff"], 3)
            ctx["admins"] = self._scoped_users(college, ["admin", "super_admin"], 3)
            ctx["hr"] = self._scoped_users(college, ["hr"], 2)
            ctx["pd"] = self._scoped_users(college, ["pd"], 2)
            ctx["hod"] = self._scoped_users(college, ["hod"], 2)

            if not ctx["students"]:
                self.stderr.write(
                    self.style.ERROR("No students found. Run seed_test_users first.")
                )
                return

            if not ctx["admins"] and not ctx["wardens"]:
                self.stderr.write(
                    self.style.ERROR("No admin/warden users found. Run seed_test_users first.")
                )
                return

            self.stdout.write(
                f"  Context users: students={len(ctx['students'])}, wardens={len(ctx['wardens'])}, "
                f"admins={len(ctx['admins'])}, chefs={len(ctx['chefs'])}, security={len(ctx['security'])}"
            )

            self._seed_rooms(ctx)
            self._seed_attendance(ctx)
            self._seed_gate_passes(ctx)
            self._seed_leaves(ctx)
            self._seed_meals(ctx)
            self._seed_notices(ctx)
            self._seed_events(ctx)
            self._seed_complaints(ctx)
            self._seed_visitors(ctx)
            self._seed_hall_bookings(ctx)
            self._seed_sports(ctx)
            self._seed_disciplinary(ctx)
            self._seed_placements(ctx)
            self._seed_messages(ctx)
            self._seed_notifications(ctx)

        self.stdout.write(f"\n{'='*60}")
        self.stdout.write(self.style.SUCCESS("  ALL TEST DATA SEEDED SUCCESSFULLY"))
        self.stdout.write(
            f"  Cleanup: python manage.py teardown_test_data"
        )
        self.stdout.write(f"{'='*60}\n")

    # ── Rooms ──────────────────────────────────────────────────

    def _seed_rooms(self, ctx):
        from apps.rooms.models import Hostel, Building, Room, Bed, RoomAllocation

        college = ctx["college"]
        hostel, _ = Hostel.objects.get_or_create(
            name="Main Hostel", college=college
        )
        building, _ = Building.objects.get_or_create(
            code="BA1",
            defaults={
                "name": "Block-A",
                "hostel": hostel,
                "total_floors": 4,
                "gender_type": "boys",
                "college": college,
            },
        )
        building_g, _ = Building.objects.get_or_create(
            code="BG1",
            defaults={
                "name": "Block-G",
                "hostel": hostel,
                "total_floors": 3,
                "gender_type": "girls",
                "college": college,
            },
        )
        ctx["building"] = building
        ctx["building_g"] = building_g

        room_count = 0
        for bld in [building, building_g]:
            for floor in range(1, 4):
                for num in range(1, 6):
                    room_no = f"{floor}0{num}"
                    room, created = Room.objects.get_or_create(
                        building=bld,
                        room_number=room_no,
                        defaults={
                            "floor": floor,
                            "room_type": "triple",
                            "capacity": 3,
                            "status": "available",
                            "college": college,
                            "trace_id": seed_trace(),
                        },
                    )
                    if created:
                        room_count += 1
                        for b in range(1, 4):
                            Bed.objects.get_or_create(
                                room=room,
                                bed_number=str(b),
                                defaults={"college": college, "trace_id": seed_trace()},
                            )

        # Allocate students to rooms
        alloc_count = 0
        available_beds = list(
            Bed.objects.filter(
                room__building__in=[building, building_g], is_occupied=False
            ).select_related("room")[:len(ctx["students"])]
        )
        for student, bed in zip(ctx["students"], available_beds):
            if RoomAllocation.objects.filter(
                student=student, end_date__isnull=True
            ).exists():
                continue
            RoomAllocation.objects.create(
                student=student,
                room=bed.room,
                bed=bed,
                status="approved",
                allocated_date=date.today() - timedelta(days=30),
                college=college,
                trace_id=seed_trace(),
            )
            bed.is_occupied = True
            bed.save(update_fields=["is_occupied"])
            bed.room.current_occupancy = min(
                bed.room.current_occupancy + 1, bed.room.capacity
            )
            bed.room.save(update_fields=["current_occupancy"])
            alloc_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✅ Rooms: {room_count} rooms, {alloc_count} allocations"
            )
        )

    # ── Attendance ─────────────────────────────────────────────

    def _seed_attendance(self, ctx):
        from apps.attendance.models import Attendance

        college = ctx["college"]
        statuses = ["present", "present", "present", "present", "absent", "late", "excused"]
        count = 0
        today = date.today()
        for student in ctx["students"]:
            for day_offset in range(30):
                d = today - timedelta(days=day_offset)
                if d.weekday() == 6:  # skip Sunday
                    continue
                _, created = Attendance.objects.get_or_create(
                    user=student,
                    attendance_date=d,
                    defaults={
                        "status": random.choice(statuses),
                        "college": college,
                        "trace_id": seed_trace(),
                    },
                )
                if created:
                    count += 1

        self.stdout.write(self.style.SUCCESS(f"  ✅ Attendance: {count} records"))

    # ── Gate Passes ────────────────────────────────────────────

    def _seed_gate_passes(self, ctx):
        from apps.gate_passes.models import GatePass
        from apps.analytics.models import DailyHostelMetrics

        college = ctx["college"]
        now = timezone.now()

        # Pre-seed analytics metrics so the GatePass post_save signal doesn't
        # violate the PositiveIntegerField constraint when decrementing.
        student_count = max(len(ctx["students"]), 50)
        # Collect unique tenant_ids from students and always include target college tenant.
        tenant_ids = {str(college.id) if college and college.id else None}
        for s in ctx["students"]:
            tenant_ids.add(s.tenant_id)  # may be None
        for tid in tenant_ids:
            metrics, created = DailyHostelMetrics.objects.get_or_create(
                tenant_id=tid,
                date=now.date(),
                defaults={
                    "total_students": student_count,
                    "students_present": student_count,
                    "students_outside": 0,
                },
            )
            if not created and (
                metrics.students_present < student_count
                or metrics.total_students < student_count
            ):
                metrics.students_present = student_count
                metrics.total_students = student_count
                metrics.save(update_fields=["students_present", "total_students"])

        pass_configs = [
            # (pass_type, status, days_ago)
            ("day", "pending", 0),
            ("day", "approved", 1),
            ("overnight", "out", 2),
            ("weekend", "completed", 5),
            ("emergency", "approved", 1),
            ("day", "rejected", 3),
            ("day", "expired", 10),
            ("leave", "in", 4),
        ]
        count = 0
        approver = ctx["wardens"][0] if ctx["wardens"] else None
        sec = ctx["security"][0] if ctx["security"] else None

        for student in ctx["students"][:8]:
            cfg = pass_configs[count % len(pass_configs)]
            pass_type, status, days_ago = cfg
            exit_dt = now - timedelta(days=days_ago, hours=random.randint(8, 14))
            entry_dt = exit_dt + timedelta(hours=random.randint(4, 24))

            gp = GatePass(
                student=student,
                pass_type=pass_type,
                status=status,
                exit_date=exit_dt,
                entry_date=entry_dt,
                reason=f"Test {pass_type} pass — {status}",
                destination=random.choice(["Home", "Market", "Hospital", "Library", "Station"]),
                college=college,
                trace_id=seed_trace(),
            )
            if status in ("approved", "out", "completed", "in") and approver:
                gp.approved_by = approver
                gp.approved_at = exit_dt - timedelta(hours=1)
            if status == "out":
                gp.actual_exit_at = exit_dt
                gp.exit_security = sec
                gp.movement_status = "outside"
            elif status == "in":
                gp.actual_exit_at = exit_dt
                gp.actual_entry_at = entry_dt
                gp.exit_security = sec
                gp.entry_security = sec
                gp.movement_status = "returned"
            elif status == "completed":
                gp.actual_exit_at = exit_dt
                gp.actual_entry_at = entry_dt
                gp.movement_status = "returned"
            elif status == "rejected":
                gp.reject_reason = "Not a valid reason for leave."
            gp.save()
            count += 1

        self.stdout.write(self.style.SUCCESS(f"  ✅ Gate Passes: {count} records"))

    # ── Leaves ─────────────────────────────────────────────────

    def _seed_leaves(self, ctx):
        from apps.leaves.models import LeaveApplication

        college = ctx["college"]
        today = date.today()
        leave_configs = [
            ("sick", "APPROVED", -5, -3),
            ("personal", "PENDING_APPROVAL", 2, 4),
            ("vacation", "COMPLETED", -20, -15),
            ("emergency", "ACTIVE", 0, 1),
            ("academic", "REJECTED", 5, 7),
            ("family", "CANCELLED", 10, 12),
        ]
        count = 0
        approver = ctx["wardens"][0] if ctx["wardens"] else None

        for student in ctx["students"][:6]:
            cfg = leave_configs[count % len(leave_configs)]
            lt, status, start_off, end_off = cfg
            la = LeaveApplication(
                student=student,
                leave_type=lt,
                start_date=today + timedelta(days=start_off),
                end_date=today + timedelta(days=end_off),
                reason=f"Test {lt} leave application",
                status=status,
                college=college,
                destination="Home" if lt != "academic" else "Conference",
                parent_contact="9876543210",
                trace_id=seed_trace(),
            )
            if status in ("APPROVED", "ACTIVE", "COMPLETED") and approver:
                la.approved_by = approver
                la.approved_at = timezone.now() - timedelta(days=abs(start_off) + 1)
            if status == "REJECTED":
                la.rejection_reason = "Insufficient justification."
            la.save()
            count += 1

        self.stdout.write(self.style.SUCCESS(f"  ✅ Leaves: {count} records"))

    # ── Meals ──────────────────────────────────────────────────

    def _seed_meals(self, ctx):
        from apps.meals.models import Meal, MealItem, MealFeedback, MealAttendance

        college = ctx["college"]
        chef = ctx["chefs"][0] if ctx["chefs"] else ctx["admins"][0]
        today = date.today()

        meal_menus = {
            "breakfast": [("Idli", "4 pcs"), ("Sambar", "1 bowl"), ("Coffee", "1 cup")],
            "lunch": [("Rice", "Unlimited"), ("Dal", "1 bowl"), ("Paneer", "1 plate"), ("Curd", "1 cup")],
            "dinner": [("Chapati", "4 pcs"), ("Sabzi", "1 bowl"), ("Salad", "1 plate")],
            "snacks": [("Tea", "1 cup"), ("Biscuits", "2 pcs")],
        }

        meal_count = 0
        for day_offset in range(7):
            d = today - timedelta(days=day_offset)
            for meal_type, items in meal_menus.items():
                meal, created = Meal.objects.get_or_create(
                    meal_date=d,
                    meal_type=meal_type,
                    defaults={
                        "description": f"{meal_type.title()} for {d}",
                        "cost": Decimal("30.00") if meal_type == "snacks" else Decimal("60.00"),
                        "created_by": chef,
                        "menu_posted": True,
                        "posted_at": timezone.now() - timedelta(days=day_offset, hours=6),
                        "posted_by": chef,
                        "college": college,
                        "trace_id": seed_trace(),
                    },
                )
                if not created:
                    continue
                meal_count += 1

                for item_name, qty in items:
                    MealItem.objects.create(
                        meal=meal, name=item_name, quantity=qty,
                        college=college, trace_id=seed_trace(),
                    )

                # Feedback from a few students
                if day_offset < 3:
                    for student in ctx["students"][:4]:
                        MealFeedback.objects.get_or_create(
                            meal=meal,
                            user=student,
                            defaults={
                                "rating": random.randint(2, 5),
                                "comment": random.choice([
                                    "Good food!", "Could be better.",
                                    "Loved the menu today.", "Needs more variety.",
                                    ""
                                ]),
                                "college": college,
                                "trace_id": seed_trace(),
                            },
                        )

                # Attendance for past meals
                if day_offset > 0:
                    for student in ctx["students"][:10]:
                        MealAttendance.objects.get_or_create(
                            meal=meal,
                            student=student,
                            defaults={
                                "status": random.choice(["taken", "taken", "skipped"]),
                                "college": college,
                                "trace_id": seed_trace(),
                            },
                        )

        self.stdout.write(self.style.SUCCESS(f"  ✅ Meals: {meal_count} meals with items/feedback"))

    # ── Notices ────────────────────────────────────────────────

    def _seed_notices(self, ctx):
        from apps.notices.models import Notice

        college = ctx["college"]
        author = ctx["admins"][0] if ctx["admins"] else ctx["wardens"][0]
        notices_data = [
            ("Hostel Timings Updated", "All students must return by 9 PM starting next week.", "high", "all"),
            ("Mess Menu Change", "New winter menu will be effective from Monday.", "medium", "students"),
            ("Water Supply Maintenance", "Water supply will be interrupted on Saturday 6AM-12PM.", "urgent", "all"),
            ("Sports Day Announcement", "Annual sports day on 15th March. Register now!", "low", "students"),
            ("Exam Week Guidelines", "Silence hours 10PM-6AM strictly enforced.", "high", "students"),
            ("Staff Meeting", "Monthly staff meeting on Friday 3PM in Auditorium.", "medium", "staff"),
            ("Fee Payment Reminder", "Last date for hostel fee is end of this month.", "high", "students"),
        ]
        count = 0
        for title, content, priority, audience in notices_data:
            _, created = Notice.objects.get_or_create(
                title=title,
                college=college,
                defaults={
                    "content": content,
                    "priority": priority,
                    "author": author,
                    "is_published": True,
                    "target_audience": audience,
                    "trace_id": seed_trace(),
                },
            )
            if created:
                count += 1

        self.stdout.write(self.style.SUCCESS(f"  ✅ Notices: {count} records"))

    # ── Events ─────────────────────────────────────────────────

    def _seed_events(self, ctx):
        from apps.events.models import Event, EventRegistration

        college = ctx["college"]
        creator = ctx["admins"][0] if ctx["admins"] else ctx["staff"][0]
        now = timezone.now()

        events_data = [
            ("Diwali Cultural Night", "cultural", "published", 2, "Auditorium"),
            ("Guest Lecture: AI in Healthcare", "academic", "published", 5, "Seminar Hall"),
            ("Inter-Hostel Cricket", "sports", "draft", 10, "Cricket Ground"),
            ("Annual Day", "cultural", "published", 15, "Main Stage"),
            ("Blood Donation Camp", "academic", "completed", -3, "Medical Center"),
        ]
        ev_count = 0
        reg_count = 0

        for title, etype, status, days_ahead, location in events_data:
            start = now + timedelta(days=days_ahead, hours=10)
            ev, created = Event.objects.get_or_create(
                title=title,
                college=college,
                defaults={
                    "description": f"Test event: {title}",
                    "event_type": etype,
                    "start_time": start,
                    "end_time": start + timedelta(hours=3),
                    "location": location,
                    "created_by": creator,
                    "status": status,
                    "capacity": random.randint(50, 200),
                    "trace_id": seed_trace(),
                },
            )
            if created:
                ev_count += 1

            # Register students for published events
            if status == "published" and created:
                for student in ctx["students"][:5]:
                    _, rc = EventRegistration.objects.get_or_create(
                        event=ev,
                        student=student,
                        defaults={
                            "status": "registered",
                            "college": college,
                            "trace_id": seed_trace(),
                        },
                    )
                    if rc:
                        reg_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✅ Events: {ev_count} events, {reg_count} registrations"
            )
        )

    # ── Complaints ─────────────────────────────────────────────

    def _seed_complaints(self, ctx):
        from apps.complaints.models import Complaint, ComplaintUpdate

        college = ctx["college"]
        warden = ctx["wardens"][0] if ctx["wardens"] else None
        complaints_data = [
            ("Broken window in room 102", "room", "high", "open", "2"),
            ("Water leaking from tap", "plumbing", "critical", "assigned", "1"),
            ("Fan not working", "electrical", "medium", "in_progress", "3"),
            ("Food quality issue", "mess", "medium", "resolved", "3"),
            ("Unclean washroom", "cleaning", "high", "open", "2"),
            ("Noisy neighbors", "room", "low", "closed", "4"),
            ("WiFi not working", "electrical", "high", "open", "2"),
            ("Broken chair in study room", "room", "low", "invalid", "4"),
        ]
        count = 0
        for i, (title, cat, sev, status, priority) in enumerate(complaints_data):
            student = ctx["students"][i % len(ctx["students"])]
            c, created = Complaint.objects.get_or_create(
                title=title,
                student=student,
                college=college,
                defaults={
                    "category": cat,
                    "description": f"Detailed description: {title}",
                    "status": status,
                    "priority": priority,
                    "assigned_to": warden if status in ("assigned", "in_progress") else None,
                    "trace_id": seed_trace(),
                },
            )
            if created:
                count += 1
                if status in ("resolved", "closed") and warden:
                    ComplaintUpdate.objects.create(
                        complaint=c,
                        user=warden,
                        status_from="open",
                        status_to=status,
                        comment=f"Issue has been {status}.",
                        college=college,
                        trace_id=seed_trace(),
                    )

        self.stdout.write(self.style.SUCCESS(f"  ✅ Complaints: {count} records"))

    # ── Visitors ───────────────────────────────────────────────

    def _seed_visitors(self, ctx):
        from apps.visitors.models import VisitorLog, VisitorPreRegistration

        college = ctx["college"]
        now = timezone.now()
        visitor_data = [
            ("Rajesh Kumar", "Father", "9876543001", "Monthly visit"),
            ("Priya Sharma", "Mother", "9876543002", "Bringing supplies"),
            ("Amit Verma", "Friend", "9876543003", "Study materials exchange"),
            ("Dr. Patel", "Guardian", "9876543004", "Academic discussion"),
        ]
        log_count = 0
        prereg_count = 0

        for i, (name, rel, phone, purpose) in enumerate(visitor_data):
            student = ctx["students"][i % len(ctx["students"])]

            # Pre-registration
            _, created = VisitorPreRegistration.objects.get_or_create(
                student=student,
                visitor_name=name,
                expected_date=date.today() + timedelta(days=i),
                defaults={
                    "relationship": rel,
                    "phone_number": phone,
                    "purpose": purpose,
                    "status": random.choice(["pending", "approved"]),
                    "college": college,
                    "trace_id": seed_trace(),
                },
            )
            if created:
                prereg_count += 1

            # Past visitor log
            if i < 2:
                _, created = VisitorLog.objects.get_or_create(
                    student=student,
                    visitor_name=name,
                    check_in=now - timedelta(days=i + 1, hours=10),
                    defaults={
                        "relationship": rel,
                        "phone_number": phone,
                        "purpose": purpose,
                        "id_proof_number": f"ID{random.randint(100000, 999999)}",
                        "is_active": False,
                        "check_out": now - timedelta(days=i + 1, hours=7),
                        "college": college,
                        "trace_id": seed_trace(),
                    },
                )
                if created:
                    log_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✅ Visitors: {log_count} logs, {prereg_count} pre-registrations"
            )
        )

    # ── Hall Bookings ──────────────────────────────────────────

    def _seed_hall_bookings(self, ctx):
        from apps.hall_booking.models import Hall, HallBooking, HallSlot, HallEquipment

        college = ctx["college"]
        manager = ctx["admins"][0] if ctx["admins"] else None
        today = date.today()

        # Create halls
        halls_data = [
            ("HALL-A", "Main Auditorium", 500, "Campus Center"),
            ("HALL-B", "Seminar Hall", 100, "Academic Block"),
            ("HALL-C", "Conference Room", 30, "Admin Block"),
        ]
        halls = []
        for hid, name, cap, loc in halls_data:
            h, _ = Hall.objects.get_or_create(
                hall_id=hid,
                defaults={
                    "hall_name": name,
                    "capacity": cap,
                    "location": loc,
                    "status": "open",
                    "manager": manager,
                    "trace_id": seed_trace(),
                },
            )
            halls.append(h)

            # Create slots for each hall
            for start_h in [9, 14, 18]:
                HallSlot.objects.get_or_create(
                    hall=h,
                    start_time=time(start_h, 0),
                    end_time=time(start_h + 3, 0),
                    defaults={"status": "open", "trace_id": seed_trace()},
                )

        # Equipment
        for eq_name in ["Projector", "Microphone Set", "Whiteboard", "Sound System"]:
            HallEquipment.objects.get_or_create(
                name=eq_name, defaults={"trace_id": seed_trace()}
            )

        # Bookings
        booking_count = 0
        statuses = ["pending", "approved", "approved", "rejected"]
        requester = ctx["staff"][0] if ctx["staff"] else ctx["admins"][0]

        for i, hall in enumerate(halls):
            for day_off in [2, 7, 14]:
                bk_date = today + timedelta(days=day_off)
                status = statuses[(i + day_off) % len(statuses)]
                slot = HallSlot.objects.filter(hall=hall).first()
                _, created = HallBooking.objects.get_or_create(
                    hall=hall,
                    booking_date=bk_date,
                    start_time=time(10, 0),
                    end_time=time(13, 0),
                    defaults={
                        "requester": requester,
                        "event_name": f"Event at {hall.hall_name} on {bk_date}",
                        "department": random.choice(["CSE", "ECE", "Mech", "Admin"]),
                        "expected_participants": random.randint(20, hall.capacity),
                        "description": f"Test booking for {hall.hall_name}",
                        "status": status,
                        "slot": slot,
                        "college": college,
                        "reviewed_by": manager if status != "pending" else None,
                        "trace_id": seed_trace(),
                    },
                )
                if created:
                    booking_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✅ Hall Bookings: {len(halls)} halls, {booking_count} bookings"
            )
        )

    # ── Sports ─────────────────────────────────────────────────

    def _seed_sports(self, ctx):
        from apps.sports.models import (
            Sport,
            SportCourt,
            CourtSlot,
            SportSlotBooking,
            SportsPolicy,
        )

        college = ctx["college"]
        today = date.today()

        # Policy
        SportsPolicy.objects.get_or_create(
            college=college,
            defaults={"max_bookings_per_day": 2, "max_bookings_per_week": 5},
        )

        sports_data = [
            ("Badminton", "doubles", 2, 4, "🏸"),
            ("Cricket", "team", 11, 22, "🏏"),
            ("Table Tennis", "singles", 2, 4, "🏓"),
            ("Basketball", "team", 5, 10, "🏀"),
            ("Football", "team", 11, 22, "⚽"),
        ]
        slot_count = 0
        booking_count = 0

        for name, gtype, minp, maxp, icon in sports_data:
            sport, _ = Sport.objects.get_or_create(
                college=college,
                name=name,
                defaults={
                    "game_type": gtype,
                    "min_players": minp,
                    "max_players": maxp,
                    "icon": icon,
                    "status": "active",
                },
            )

            court, _ = SportCourt.objects.get_or_create(
                college=college,
                sport=sport,
                name=f"{name} Court 1",
                defaults={
                    "location": "Sports Complex",
                    "capacity": maxp,
                    "status": "open",
                },
            )

            # Create slots for next 5 days
            for day_off in range(5):
                d = today + timedelta(days=day_off)
                for start_h in [6, 8, 16, 18]:
                    slot, created = CourtSlot.objects.get_or_create(
                        court=court,
                        date=d,
                        start_time=time(start_h, 0),
                        end_time=time(start_h + 1, 30),
                        defaults={
                            "college": college,
                            "max_players": maxp,
                        },
                    )
                    if created:
                        slot_count += 1

                    # Book some slots
                    if day_off < 2 and start_h == 16 and created:
                        for student in ctx["students"][:min(3, minp)]:
                            SportSlotBooking.objects.create(
                                college=college,
                                slot=slot,
                                student=student,
                                status="confirmed",
                            )
                            booking_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✅ Sports: {len(sports_data)} sports, {slot_count} slots, {booking_count} bookings"
            )
        )

    # ── Disciplinary ───────────────────────────────────────────

    def _seed_disciplinary(self, ctx):
        from apps.disciplinary.models import DisciplinaryAction, FineLedgerEntry

        college = ctx["college"]
        warden = ctx["wardens"][0] if ctx["wardens"] else ctx["admins"][0]
        actions_data = [
            ("Late return after curfew", "late", "low", Decimal("100.00"), True),
            ("Damaged hostel property", "damage", "medium", Decimal("500.00"), False),
            ("Noise complaint", "noise", "low", Decimal("50.00"), True),
            ("Misconduct during event", "misconduct", "high", Decimal("1000.00"), False),
        ]
        count = 0
        for i, (title, atype, severity, fine, paid) in enumerate(actions_data):
            student = ctx["students"][i % len(ctx["students"])]
            da, created = DisciplinaryAction.objects.get_or_create(
                student=student,
                title=title,
                defaults={
                    "college": college,
                    "action_type": atype,
                    "severity": severity,
                    "description": f"Incident: {title}",
                    "fine_amount": fine,
                    "is_paid": paid,
                    "paid_date": timezone.now() if paid else None,
                    "action_taken_by": warden,
                    "trace_id": seed_trace(),
                },
            )
            if created:
                count += 1
                # Ledger entry for fine issued
                FineLedgerEntry.objects.create(
                    college=college,
                    disciplinary_action=da,
                    student=student,
                    entry_type="issued",
                    amount=fine,
                    balance_after=fine,
                    notes=f"Fine issued for {title}",
                    created_by=warden,
                    trace_id=seed_trace(),
                )
                if paid:
                    FineLedgerEntry.objects.create(
                        college=college,
                        disciplinary_action=da,
                        student=student,
                        entry_type="payment",
                        amount=-fine,
                        balance_after=Decimal("0"),
                        notes="Payment received",
                        created_by=warden,
                        trace_id=seed_trace(),
                    )

        self.stdout.write(self.style.SUCCESS(f"  ✅ Disciplinary: {count} actions + ledger"))

    # ── Placements ─────────────────────────────────────────────

    def _seed_placements(self, ctx):
        from apps.placements.models import Company, JobPosting, Application

        college = ctx["college"]
        admin = ctx["admins"][0] if ctx["admins"] else None
        now = timezone.now()

        companies_data = [
            ("TechCorp India", "Technology", "hr@techcorp.com"),
            ("FinServe Ltd", "Finance", "careers@finserve.com"),
            ("HealthPlus", "Healthcare", "jobs@healthplus.com"),
        ]
        job_count = 0
        app_count = 0

        for name, industry, email in companies_data:
            company, _ = Company.objects.get_or_create(
                name=name,
                college=college,
                defaults={
                    "industry": industry,
                    "contact_email": email,
                    "description": f"{name} — a leading {industry.lower()} company.",
                    "trace_id": seed_trace(),
                },
            )

            for j in range(2):
                title = f"{'Software Engineer' if j == 0 else 'Data Analyst'} at {name}"
                job, created = JobPosting.objects.get_or_create(
                    company=company,
                    title=title,
                    college=college,
                    defaults={
                        "description": f"Exciting opportunity as {title}.",
                        "package": Decimal(random.randint(5, 25)) * Decimal("100000"),
                        "location": random.choice(["Bangalore", "Hyderabad", "Chennai", "Pune"]),
                        "min_cgpa": Decimal("6.5"),
                        "application_deadline": now + timedelta(days=30 + j * 15),
                        "status": "open",
                        "created_by": admin,
                        "trace_id": seed_trace(),
                    },
                )
                if created:
                    job_count += 1

                    # Applications from students
                    statuses = ["applied", "shortlisted", "interview", "selected", "rejected"]
                    for k, student in enumerate(ctx["students"][:5]):
                        Application.objects.get_or_create(
                            student=student,
                            job=job,
                            defaults={
                                "status": statuses[k % len(statuses)],
                                "college": college,
                                "trace_id": seed_trace(),
                            },
                        )
                        app_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"  ✅ Placements: {len(companies_data)} companies, {job_count} jobs, {app_count} applications"
            )
        )

    # ── Messages ───────────────────────────────────────────────

    def _seed_messages(self, ctx):
        from apps.messages.models import Message, BroadcastMessage

        msg_count = 0
        # Direct messages
        if len(ctx["students"]) >= 2 and ctx["wardens"]:
            pairs = [
                (ctx["students"][0], ctx["wardens"][0], "Room allocation query"),
                (ctx["wardens"][0], ctx["students"][0], "Re: Room allocation query"),
                (ctx["students"][1], ctx["admins"][0], "Fee payment issue"),
            ]
            for sender, recipient, subject in pairs:
                Message.objects.create(
                    sender=sender,
                    recipient=recipient,
                    subject=subject,
                    body=f"This is a test message regarding: {subject}",
                    trace_id=seed_trace(),
                )
                msg_count += 1

        # Broadcast
        if ctx["admins"]:
            BroadcastMessage.objects.create(
                sender=ctx["admins"][0],
                subject="Welcome to the new semester!",
                body="We hope you have a great semester. Please check the notice board for updates.",
                is_published=True,
                target_audience="all",
                trace_id=seed_trace(),
            )
            msg_count += 1

        self.stdout.write(self.style.SUCCESS(f"  ✅ Messages: {msg_count} records"))

    # ── Notifications ──────────────────────────────────────────

    def _seed_notifications(self, ctx):
        from apps.notifications.models import Notification

        college = ctx["college"]
        notif_data = [
            ("Gate pass approved", "Your day pass has been approved.", "info"),
            ("Attendance marked", "Your attendance for today is recorded.", "info"),
            ("Complaint update", "Your complaint #C-102 has been resolved.", "alert"),
            ("Fee reminder", "Hostel fee due by end of month.", "warning"),
            ("New notice posted", "Check the latest notice from administration.", "info"),
        ]
        count = 0
        for student in ctx["students"][:5]:
            for title, msg, ntype in notif_data:
                Notification.objects.create(
                    recipient=student,
                    title=title,
                    message=msg,
                    notification_type=ntype,
                    is_read=random.choice([True, False]),
                    college=college,
                    trace_id=seed_trace(),
                )
                count += 1

        self.stdout.write(self.style.SUCCESS(f"  ✅ Notifications: {count} records"))
