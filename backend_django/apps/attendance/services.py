"""Service helpers for attendance mutations."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime

import pytz
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status

from apps.auth.models import User
from apps.events.models import Event
from apps.gate_passes.models import GatePass
from apps.rooms.models import RoomAllocation
from core.role_scopes import has_scope_access, user_is_top_level_management
from core.services import broadcast_attendance_event, broadcast_forecast_refresh
from websockets.broadcast import broadcast_to_management

from .models import Attendance

logger = logging.getLogger(__name__)


@dataclass
class AttendanceMutationResult:
    status_code: int
    payload: dict | None = None
    record: Attendance | None = None


def _is_holiday_for_date(target_date, college=None):
    cf = Q(college=college) if college else Q()
    return Event.objects.filter(
        cf & Q(
            is_holiday=True,
            start_time__date__lte=target_date,
            end_time__date__gte=target_date,
        )
    ).exists()


def _is_student_out_on_gatepass(student_id, attendance_date: date) -> bool:
    start_of_day = datetime.combine(attendance_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    end_of_day = datetime.combine(attendance_date, datetime.max.time()).replace(tzinfo=timezone.utc)
    return GatePass.objects.filter(
        student_id=student_id,
        status__in=['out', 'outside', 'used', 'late_return'],
        exit_date__lte=end_of_day,
    ).filter(
        Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
    ).exists()


class AttendanceService:
    """Encapsulate attendance mutation business rules."""

    @staticmethod
    def sync_missing_records(*, actor, target_date) -> AttendanceMutationResult:
        if _is_holiday_for_date(target_date, getattr(actor, 'college', None)):
            return AttendanceMutationResult(
                status_code=status.HTTP_400_BAD_REQUEST,
                payload={'detail': 'Attendance sync is blocked on a configured holiday.', 'code': 'HOLIDAY_ATTENDANCE_BLOCKED'},
            )

        with transaction.atomic():
            college_id = getattr(actor, 'college_id', None)
            cf = Q(college_id=college_id) if college_id else Q()
            all_students = User.objects.filter(cf & Q(role='student', is_active=True)).only('id', 'username', 'registration_number')

            existing_attendance_ids = Attendance.objects.filter(
                attendance_date=target_date
            ).values_list('user_id', flat=True)

            students_without_attendance = list(all_students.exclude(id__in=existing_attendance_ids))
            student_ids = [student.id for student in students_without_attendance]

            start_of_day = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=pytz.UTC)
            end_of_day = datetime.combine(target_date, datetime.max.time()).replace(tzinfo=pytz.UTC)
            active_gps = set(GatePass.objects.filter(
                student_id__in=student_ids,
                status__in=['out', 'outside', 'used', 'late_return'],
                exit_date__lte=end_of_day,
            ).filter(
                Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
            ).values_list('student_id', flat=True))

            allocations_by_student = {
                allocation.student_id: allocation
                for allocation in RoomAllocation.objects.filter(
                    student_id__in=student_ids,
                    end_date__isnull=True,
                ).select_related('room')
            }

            records_to_create = []
            skipped_deallocated = 0
            for student in students_without_attendance:
                active_alloc = allocations_by_student.get(student.id)
                if not active_alloc and student.id not in active_gps:
                    skipped_deallocated += 1
                    continue

                status_value = 'out_gatepass' if student.id in active_gps else 'absent'
                block_id = active_alloc.room.building_id if active_alloc else None
                floor = active_alloc.room.floor if active_alloc else None

                records_to_create.append(
                    Attendance(
                        user_id=student.id,
                        college_id=getattr(student, 'college_id', None),
                        attendance_date=target_date,
                        status=status_value,
                        block_id=block_id,
                        floor=floor,
                    )
                )

            if records_to_create:
                Attendance.objects.bulk_create(records_to_create, batch_size=500)

            broadcast_forecast_refresh(target_date)

            detail = f'Sync complete. {len(records_to_create)} records created.'
            if skipped_deallocated:
                detail = f'{detail} Skipped {skipped_deallocated} deallocated students without active gate pass.'

            return AttendanceMutationResult(
                status_code=status.HTTP_200_OK,
                payload={'detail': detail},
            )

    @staticmethod
    def mark_attendance(*, actor, student_id, status_value, attendance_date) -> AttendanceMutationResult:
        if not user_is_top_level_management(actor) and _is_holiday_for_date(attendance_date, getattr(actor, 'college', None)):
            return AttendanceMutationResult(
                status_code=status.HTTP_400_BAD_REQUEST,
                payload={'detail': 'Attendance cannot be marked on a configured holiday.', 'code': 'HOLIDAY_ATTENDANCE_BLOCKED'},
            )

        try:
            student = User.objects.get(id=student_id)
        except User.DoesNotExist:
            return AttendanceMutationResult(
                status_code=status.HTTP_404_NOT_FOUND,
                payload={'detail': 'Student not found.'},
            )

        active_alloc = RoomAllocation.objects.filter(student=student, end_date__isnull=True).select_related('room').first()
        if active_alloc:
            building_id = active_alloc.room.building_id
            floor = active_alloc.room.floor
        else:
            latest_alloc = RoomAllocation.objects.filter(student=student).select_related('room').order_by('-end_date', '-allocated_date', '-id').first()
            building_id = latest_alloc.room.building_id if latest_alloc and latest_alloc.room else None
            floor = latest_alloc.room.floor if latest_alloc and latest_alloc.room else None

        if not has_scope_access(actor, building_id=building_id, floor=floor) and not user_is_top_level_management(actor):
            return AttendanceMutationResult(
                status_code=status.HTTP_403_FORBIDDEN,
                payload={'detail': 'Insufficient authority to mark attendance for this student or area.'},
            )

        student_pk = student.id
        if not active_alloc:
            if _is_student_out_on_gatepass(student_pk, attendance_date):
                record, _ = Attendance.objects.update_or_create(
                    user_id=student_pk,
                    attendance_date=attendance_date,
                    defaults={
                        'college_id': getattr(student, 'college_id', None),
                        'status': 'out_gatepass',
                        'block_id': building_id,
                        'floor': floor,
                    }
                )
                broadcast_attendance_event(student_pk, attendance_date, 'out_gatepass', building_id)
                broadcast_forecast_refresh(attendance_date)
                return AttendanceMutationResult(
                    status_code=status.HTTP_200_OK,
                    record=record,
                    payload={
                        'code': 'STUDENT_OUT_DEALLOCATED',
                        'detail': 'Student is deallocated and currently outside on gate pass.',
                    },
                )

            return AttendanceMutationResult(
                status_code=status.HTTP_400_BAD_REQUEST,
                payload={
                    'detail': 'Student is deallocated; manual attendance is blocked unless gate pass marks them outside.',
                    'code': 'STUDENT_DEALLOCATED',
                },
            )

        valid_statuses = [choice[0] for choice in Attendance.STATUS_CHOICES]
        if status_value not in valid_statuses:
            return AttendanceMutationResult(
                status_code=status.HTTP_400_BAD_REQUEST,
                payload={'detail': f'Invalid status. Allowed: {", ".join(valid_statuses)}'},
            )

        existing_record = Attendance.objects.filter(user_id=student_id, attendance_date=attendance_date).first()
        if existing_record and existing_record.is_locked and not user_is_top_level_management(actor):
            return AttendanceMutationResult(
                status_code=status.HTTP_403_FORBIDDEN,
                payload={'detail': 'Attendance is locked. Contact Head Warden or Admin to modify.'},
            )

        if status_value == 'present' and _is_student_out_on_gatepass(student_pk, attendance_date):
            return AttendanceMutationResult(
                status_code=status.HTTP_400_BAD_REQUEST,
                payload={'detail': 'Student is currently OUT on an active Gate Pass.', 'code': 'STUDENT_OUT'},
            )

        record, _ = Attendance.objects.update_or_create(
            user_id=student_pk,
            attendance_date=attendance_date,
            defaults={
                'college_id': getattr(student, 'college_id', None),
                'status': status_value,
                'block_id': building_id,
                'floor': floor,
            }
        )

        broadcast_attendance_event(student_pk, attendance_date, status_value, building_id)
        broadcast_forecast_refresh(attendance_date)
        return AttendanceMutationResult(status_code=status.HTTP_200_OK, record=record)

    @staticmethod
    def mark_all(*, actor, status_value, attendance_date, building_id=None, floor=None, room_id=None) -> AttendanceMutationResult:
        if not user_is_top_level_management(actor) and _is_holiday_for_date(attendance_date, getattr(actor, 'college', None)):
            return AttendanceMutationResult(
                status_code=status.HTTP_400_BAD_REQUEST,
                payload={'detail': 'Bulk attendance marking is blocked on a configured holiday.', 'code': 'HOLIDAY_ATTENDANCE_BLOCKED'},
            )

        if not has_scope_access(actor, building_id=building_id, floor=floor):
            return AttendanceMutationResult(
                status_code=status.HTTP_403_FORBIDDEN,
                payload={'detail': 'Not authorized to perform bulk actions in this scope.'},
            )

        if Attendance.objects.filter(attendance_date=attendance_date, block_id=building_id, is_locked=True).exists() and not user_is_top_level_management(actor):
            return AttendanceMutationResult(
                status_code=status.HTTP_403_FORBIDDEN,
                payload={'detail': 'Attendance in this block is locked for the selected date.'},
            )

        college = getattr(actor, 'college', None)
        cf = Q(college=college) if college else Q()
        students = User.objects.filter(cf & Q(role='student', is_active=True)).filter(
            room_allocations__isnull=False,
            room_allocations__end_date__isnull=True,
            room_allocations__status='approved',
        )
        if building_id:
            students = students.filter(room_allocations__room__building_id=building_id)
        if floor:
            students = students.filter(room_allocations__room__floor=floor)
        if room_id:
            students = students.filter(room_allocations__room_id=room_id)

        student_ids = list(students.distinct().values_list('id', flat=True))
        if not student_ids:
            return AttendanceMutationResult(
                status_code=status.HTTP_404_NOT_FOUND,
                payload={'detail': 'No students found in the specified scope.'},
            )

        out_student_ids = set()
        if status_value == 'present':
            start_of_day = datetime.combine(attendance_date, datetime.min.time()).replace(tzinfo=pytz.UTC)
            end_of_day = datetime.combine(attendance_date, datetime.max.time()).replace(tzinfo=pytz.UTC)

            out_student_ids = set(GatePass.objects.filter(
                student_id__in=student_ids,
                status__in=['out', 'outside', 'used', 'late_return'],
                exit_date__lte=end_of_day
            ).filter(
                Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
            ).values_list('student_id', flat=True))

        records_to_create = []
        for sid in student_ids:
            effective_status = 'out_gatepass' if sid in out_student_ids and status_value == 'present' else status_value
            records_to_create.append(
                Attendance(
                    user_id=sid,
                    college_id=getattr(actor, 'college_id', None),
                    attendance_date=attendance_date,
                    status=effective_status,
                    block_id=building_id,
                    floor=floor,
                )
            )

        with transaction.atomic():
            Attendance.objects.bulk_create(
                records_to_create,
                batch_size=500,
                update_conflicts=True,
                unique_fields=['user', 'attendance_date'],
                update_fields=['college', 'status', 'block_id', 'floor']
            )

        def send_bulk_updates():
            broadcast_to_management('attendance_updated', {
                'date': attendance_date.isoformat(),
                'status': status_value,
                'building_id': building_id,
                'floor': floor,
                'count': len(student_ids),
                'resource': 'attendance',
            })

        transaction.on_commit(send_bulk_updates)
        broadcast_forecast_refresh(attendance_date)

        return AttendanceMutationResult(
            status_code=status.HTTP_200_OK,
            payload={'detail': f'Attendance marked for {len(student_ids)} students.'},
        )