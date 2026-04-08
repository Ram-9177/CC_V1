"""Service helpers for leave application workflows."""

from __future__ import annotations

import logging
from datetime import datetime, time

from django.db.models import Q
from django.utils import timezone
from django.utils.timezone import make_aware
from rest_framework.exceptions import ValidationError

from apps.gate_passes.models import GatePass
from apps.notifications.service import NotificationService
from websockets.broadcast import broadcast_to_updates_user

from .models import LeaveApplication
from .serializers import LeaveApplicationSerializer

logger = logging.getLogger(__name__)


class LeaveApplicationService:
    """Encapsulate leave submission and approval side effects."""

    @staticmethod
    def submit_application(serializer, student):
        is_outside = GatePass.objects.filter(
            student=student,
            status__in=['out', 'outside', 'used', 'late_return'],
        ).exists()
        if is_outside:
            raise ValidationError({
                'detail': 'Cannot apply for leave while outside the hostel. Please check in first.'
            })

        existing_leave = LeaveApplication.objects.filter(
            student=student,
            status__in=['PENDING_APPROVAL', 'ACTIVE']
        ).exists()
        if existing_leave:
            raise ValidationError({
                'detail': 'You already have an active or pending leave request.'
            })

        start = serializer.validated_data['start_date']
        end = serializer.validated_data['end_date']
        overlapping = LeaveApplication.objects.filter(
            student=student,
            status__in=['PENDING_APPROVAL', 'APPROVED', 'ACTIVE'],
        ).filter(Q(start_date__lte=end, end_date__gte=start)).exists()
        if overlapping:
            raise ValidationError({
                'detail': 'You already have an overlapping leave application for this period.'
            })

        save_kwargs = {'student': student, 'status': 'PENDING_APPROVAL'}
        if getattr(student, 'college', None) is not None:
            save_kwargs['college'] = student.college

        instance = serializer.save(**save_kwargs)

        try:
            from websockets.broadcast import broadcast_to_management
            from core.services import broadcast_forecast_refresh

            payload = LeaveApplicationSerializer(instance).data
            broadcast_to_management('leave_created', payload)
            broadcast_to_updates_user(student.id, 'leave_created', payload)

            leave_type_label = dict(LeaveApplication.LEAVE_TYPE_CHOICES).get(instance.leave_type, instance.leave_type)
            NotificationService.send(
                user=student,
                title='Leave Submitted 📝',
                message=f'Your {leave_type_label} request ({instance.start_date} to {instance.end_date}) has been submitted for approval.',
                notif_type='info',
                action_url='/leaves'
            )

            broadcast_forecast_refresh(instance.start_date)
            if instance.end_date != instance.start_date:
                broadcast_forecast_refresh(instance.end_date)
        except Exception as exc:
            logger.error(f'Failed to broadcast leave creation: {exc}')

        return instance

    @staticmethod
    def approve_application(leave: LeaveApplication, approver, notes=''):
        leave.status = 'APPROVED'
        leave.approved_by = approver
        leave.approved_at = timezone.now()
        leave.notes = notes or leave.notes
        leave.save(update_fields=['status', 'approved_by', 'approved_at', 'notes'])

        try:
            reason_str = f'Leave Request #{leave.id}: {leave.reason}'
            exit_datetime = make_aware(datetime.combine(leave.start_date, time(9, 0)))
            entry_datetime = make_aware(datetime.combine(leave.end_date, time(21, 0)))

            overlap_q = Q(exit_date__lte=entry_datetime) & (Q(entry_date__gte=exit_datetime) | Q(entry_date__isnull=True))
            overlap_qs = GatePass.objects.filter(
                student=leave.student,
                status__in=['pending', 'approved'],
                leave_application__isnull=True,
            ).filter(overlap_q)

            cancelled_count = 0
            for overlap_pass in overlap_qs:
                overlap_pass.status = 'cancelled'
                suffix = f'Cancelled due to approved leave #{leave.id}.'
                existing_remarks = (overlap_pass.approval_remarks or '').strip()
                overlap_pass.approval_remarks = f'{existing_remarks} {suffix}'.strip()
                overlap_pass.save(update_fields=['status', 'approval_remarks', 'updated_at'])
                cancelled_count += 1

            gate_pass = GatePass.objects.filter(leave_application=leave).first()
            if gate_pass:
                gate_pass.pass_type = 'leave'
                gate_pass.status = 'approved'
                gate_pass.exit_date = exit_datetime
                gate_pass.entry_date = entry_datetime
                gate_pass.destination = leave.destination or 'As per leave application'
                gate_pass.reason = reason_str
                gate_pass.parent_informed = leave.parent_informed
                gate_pass.approved_by = approver
                gate_pass.approved_at = timezone.now()
                gate_pass.approval_remarks = 'Auto-generated from Approved Leave Request'
                gate_pass.pending_reminded_at = None
                gate_pass.save()
            else:
                gate_pass = GatePass.objects.create(
                    student=leave.student,
                    college=leave.college,
                    leave_application=leave,
                    pass_type='leave',
                    status='approved',
                    exit_date=exit_datetime,
                    entry_date=entry_datetime,
                    destination=leave.destination or 'As per leave application',
                    reason=reason_str,
                    parent_informed=leave.parent_informed,
                    approved_by=approver,
                    approved_at=timezone.now(),
                    approval_remarks='Auto-generated from Approved Leave Request',
                    pending_reminded_at=None,
                )

            logger.info(
                'Leave %s approved: gate pass %s linked and %s overlapping manual passes cancelled',
                leave.id,
                gate_pass.id,
                cancelled_count,
            )
        except Exception as exc:
            logger.error(f'Failed to auto-create gate pass for leave {leave.id}: {exc}')

        from apps.notifications.parent_notifier import notify_parent_leave_approved
        notify_parent_leave_approved(leave)

        # ── Auto-mark attendance as on_leave for every date in the leave range ──
        try:
            from datetime import timedelta
            from apps.attendance.models import Attendance
            from apps.rooms.models import RoomAllocation

            active_alloc = RoomAllocation.objects.filter(
                student=leave.student, end_date__isnull=True
            ).select_related('room').first()
            block_id = active_alloc.room.building_id if active_alloc else None
            floor_val = active_alloc.room.floor if active_alloc else None

            leave_records = []
            current = leave.start_date
            while current <= leave.end_date:
                leave_records.append(
                    Attendance(
                        user=leave.student,
                        college=leave.college,
                        attendance_date=current,
                        status='on_leave',
                        block_id=block_id,
                        floor=floor_val,
                    )
                )
                current += timedelta(days=1)

            if leave_records:
                Attendance.objects.bulk_create(
                    leave_records,
                    batch_size=500,
                    update_conflicts=True,
                    unique_fields=['user', 'attendance_date'],
                    update_fields=['status', 'block_id', 'floor'],
                )
                logger.info('Leave %s: auto-marked %d attendance records as on_leave', leave.id, len(leave_records))
        except Exception as exc:
            logger.error('Failed to auto-mark on_leave attendance for leave %s: %s', leave.id, exc)

        try:
            from core.services import broadcast_forecast_refresh

            broadcast_to_updates_user(leave.student_id, 'leave_approved', {
                'leave_id': leave.id,
                'leave_type': leave.leave_type,
                'start_date': str(leave.start_date),
                'end_date': str(leave.end_date),
                'resource': 'leave',
            })

            NotificationService.send(
                user=leave.student,
                title='Leave Approved ✅',
                message='Leave approved. Gate pass has been automatically generated. Please exit through security.',
                notif_type='info',
                action_url='/gate-passes'
            )

            broadcast_forecast_refresh(leave.start_date)
            if leave.end_date != leave.start_date:
                broadcast_forecast_refresh(leave.end_date)
        except Exception as exc:
            logger.error(f'Failed to send leave approval notifications: {exc}')

        return leave