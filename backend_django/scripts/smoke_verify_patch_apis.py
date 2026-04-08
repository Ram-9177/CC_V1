"""Focused smoke verification for recent hardening patches.

Checks:
1) Attendance holiday blocking (mark, mark-all, sync).
2) Notice targeting count with college scoping.
3) Disciplinary fine ledger transitions.

This script runs inside a transaction and rolls back all test data.
"""

from datetime import date, timedelta
from uuid import uuid4

from django.db import transaction
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from apps.attendance.views import AttendanceViewSet
from apps.auth.models import User
from apps.colleges.models import College
from apps.disciplinary.models import FineLedgerEntry
from apps.disciplinary.views import DisciplinaryActionViewSet
from apps.events.models import Event
from apps.notices.models import NoticeLog
from apps.notices.views import NoticeViewSet
from apps.rooms.models import Building, Hostel, Room, RoomAllocation


def _assert(condition, message):
    if not condition:
        raise AssertionError(message)


def run_smoke_checks():
    suffix = uuid4().hex[:8].upper()
    today = date.today()
    factory = APIRequestFactory()

    college = College.objects.create(
        name=f"Smoke College {suffix}",
        code=f"SMK{suffix}",
        city="SmokeCity",
        state="SmokeState",
        contact_email=f"smoke-{suffix.lower()}@example.com",
    )
    other_college = College.objects.create(
        name=f"Smoke Other College {suffix}",
        code=f"OTH{suffix}",
        city="OtherCity",
        state="OtherState",
        contact_email=f"other-{suffix.lower()}@example.com",
    )

    admin = User.objects.create_user(
        username=f"SMKADM{suffix}",
        password="Pass@123",
        role="admin",
        registration_number=f"SMKADM{suffix}",
        college=college,
        email=f"admin-{suffix.lower()}@example.com",
    )
    warden = User.objects.create_user(
        username=f"SMKWRD{suffix}",
        password="Pass@123",
        role="warden",
        registration_number=f"SMKWRD{suffix}",
        college=college,
        email=f"warden-{suffix.lower()}@example.com",
    )
    hosteller = User.objects.create_user(
        username=f"SMKHST{suffix}",
        password="Pass@123",
        role="student",
        student_type="hosteller",
        registration_number=f"SMKHST{suffix}",
        college=college,
        email=f"hosteller-{suffix.lower()}@example.com",
    )
    User.objects.create_user(
        username=f"SMKDAY{suffix}",
        password="Pass@123",
        role="student",
        student_type="day_scholar",
        registration_number=f"SMKDAY{suffix}",
        college=college,
        email=f"dayscholar-{suffix.lower()}@example.com",
    )
    User.objects.create_user(
        username=f"SMKOTH{suffix}",
        password="Pass@123",
        role="student",
        student_type="hosteller",
        registration_number=f"SMKOTH{suffix}",
        college=other_college,
        email=f"other-hosteller-{suffix.lower()}@example.com",
    )

    hostel = Hostel.objects.create(name=f"Smoke Hostel {suffix}", college=college)
    building = Building.objects.create(
        name=f"Smoke Block {suffix}",
        code=f"BLK{suffix}",
        total_floors=3,
        college=college,
        hostel=hostel,
    )
    room = Room.objects.create(
        room_number="101",
        building=building,
        floor=1,
        room_type="double",
        capacity=2,
        current_occupancy=1,
        college=college,
        created_by=admin,
    )
    RoomAllocation.objects.create(
        student=hosteller,
        room=room,
        status="approved",
        allocated_date=today,
        end_date=None,
        college=college,
        allocated_by=admin,
    )
    warden.assigned_blocks.add(building)

    now = timezone.now()
    Event.objects.create(
        title=f"Holiday Smoke {suffix}",
        description="Holiday window for attendance blocking smoke test",
        event_type="academic",
        start_time=now - timedelta(hours=1),
        end_time=now + timedelta(hours=2),
        location="Campus",
        created_by=admin,
        is_holiday=True,
        college=college,
    )

    # 1) Attendance holiday blocking checks.
    sync_view = AttendanceViewSet.as_view({"post": "sync_missing_records"})
    mark_all_view = AttendanceViewSet.as_view({"post": "mark_all"})
    mark_view = AttendanceViewSet.as_view({"post": "mark"})

    sync_req = factory.post(
        "/attendance/sync_missing_records/",
        {"date": today.isoformat()},
        format="json",
    )
    force_authenticate(sync_req, user=warden)
    sync_res = sync_view(sync_req)
    _assert(sync_res.status_code == 400, f"sync_missing_records expected 400, got {sync_res.status_code}")
    _assert(sync_res.data.get("code") == "HOLIDAY_ATTENDANCE_BLOCKED", "sync_missing_records wrong error code")

    mark_all_req = factory.post(
        "/attendance/mark-all/",
        {
            "date": today.isoformat(),
            "status": "present",
            "building_id": building.id,
        },
        format="json",
    )
    force_authenticate(mark_all_req, user=warden)
    mark_all_res = mark_all_view(mark_all_req)
    _assert(mark_all_res.status_code == 400, f"mark_all expected 400, got {mark_all_res.status_code}")
    _assert(mark_all_res.data.get("code") == "HOLIDAY_ATTENDANCE_BLOCKED", "mark_all wrong error code")

    mark_req = factory.post(
        "/attendance/mark/",
        {
            "student_id": hosteller.id,
            "status": "present",
            "date": today.isoformat(),
        },
        format="json",
    )
    force_authenticate(mark_req, user=warden)
    mark_res = mark_view(mark_req)
    _assert(mark_res.status_code == 400, f"mark expected 400, got {mark_res.status_code}")
    _assert(mark_res.data.get("code") == "HOLIDAY_ATTENDANCE_BLOCKED", "mark wrong error code")

    # 2) Notice targeting count and college scoping checks.
    notice_create_view = NoticeViewSet.as_view({"post": "create"})
    notice_req = factory.post(
        "/notices/",
        {
            "title": f"Hosteller Notice {suffix}",
            "content": "Hosteller audience test",
            "priority": "high",
            "target_audience": "hostellers",
            "is_published": True,
        },
        format="json",
    )
    force_authenticate(notice_req, user=admin)
    notice_res = notice_create_view(notice_req)
    _assert(notice_res.status_code == 201, f"notice create expected 201, got {notice_res.status_code}")

    notice_id = notice_res.data["id"]
    notice_log = NoticeLog.objects.filter(notice_id=notice_id).order_by("-created_at").first()
    _assert(notice_log is not None, "notice log was not created")

    expected_count = User.objects.filter(
        is_active=True,
        role="student",
        student_type="hosteller",
        college=college,
    ).count()
    _assert(
        notice_log.users_notified_count == expected_count,
        f"notice notified count mismatch: expected {expected_count}, got {notice_log.users_notified_count}",
    )

    # 3) Disciplinary ledger transitions.
    disc_create_view = DisciplinaryActionViewSet.as_view({"post": "create"})
    disc_patch_view = DisciplinaryActionViewSet.as_view({"patch": "partial_update"})
    disc_ledger_view = DisciplinaryActionViewSet.as_view({"get": "ledger"})

    disc_create_req = factory.post(
        "/disciplinary/",
        {
            "student": hosteller.id,
            "action_type": "late",
            "severity": "medium",
            "title": "Smoke Fine",
            "description": "Smoke test disciplinary fine",
            "fine_amount": "100.00",
        },
        format="json",
    )
    force_authenticate(disc_create_req, user=warden)
    disc_create_res = disc_create_view(disc_create_req)
    _assert(disc_create_res.status_code == 201, f"disciplinary create expected 201, got {disc_create_res.status_code}")

    action_id = disc_create_res.data["id"]

    # Payment transition.
    pay_req = factory.patch(
        f"/disciplinary/{action_id}/",
        {"is_paid": True},
        format="json",
    )
    force_authenticate(pay_req, user=warden)
    pay_res = disc_patch_view(pay_req, pk=action_id)
    _assert(pay_res.status_code == 200, f"set paid expected 200, got {pay_res.status_code}")

    # Reopen transition.
    reopen_req = factory.patch(
        f"/disciplinary/{action_id}/",
        {"is_paid": False},
        format="json",
    )
    force_authenticate(reopen_req, user=warden)
    reopen_res = disc_patch_view(reopen_req, pk=action_id)
    _assert(reopen_res.status_code == 200, f"reopen expected 200, got {reopen_res.status_code}")

    # Fine adjustment transition.
    adjust_req = factory.patch(
        f"/disciplinary/{action_id}/",
        {"fine_amount": "150.00"},
        format="json",
    )
    force_authenticate(adjust_req, user=warden)
    adjust_res = disc_patch_view(adjust_req, pk=action_id)
    _assert(adjust_res.status_code == 200, f"adjust fine expected 200, got {adjust_res.status_code}")

    entry_types = list(
        FineLedgerEntry.objects.filter(disciplinary_action_id=action_id).values_list("entry_type", flat=True)
    )
    for expected_type in ["issued", "payment", "reopened", "adjustment"]:
        _assert(expected_type in entry_types, f"missing ledger entry type: {expected_type}")

    ledger_req = factory.get(f"/disciplinary/{action_id}/ledger/")
    force_authenticate(ledger_req, user=warden)
    ledger_res = disc_ledger_view(ledger_req, pk=action_id)
    _assert(ledger_res.status_code == 200, f"ledger endpoint expected 200, got {ledger_res.status_code}")
    _assert(len(ledger_res.data) >= 4, "ledger endpoint returned fewer entries than expected")

    print("SMOKE PASS: attendance holiday blocking")
    print("SMOKE PASS: notice targeting count and college scoping")
    print("SMOKE PASS: disciplinary ledger transitions")


if __name__ == "__main__":
    with transaction.atomic():
        run_smoke_checks()
        transaction.set_rollback(True)
    print("SMOKE PASS: all checks completed (transaction rolled back)")
