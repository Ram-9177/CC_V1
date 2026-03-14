"""Views for hall booking module."""

from collections import defaultdict

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notifications.utils import notify_user

from .models import Hall, HallAttendance, HallBooking, HallEquipment, HallSlot
from .serializers import (
    HallAttendanceSerializer,
    HallBookingSerializer,
    HallEquipmentSerializer,
    HallSerializer,
    HallSlotSerializer,
)


def _user_group_names(user):
    if not getattr(user, 'is_authenticated', False):
        return set()
    return {name.lower() for name in user.groups.values_list('name', flat=True)}


def is_hall_admin_user(user):
    """Admin users can manage halls and booking approvals."""
    if not getattr(user, 'is_authenticated', False):
        return False
    role = (getattr(user, 'role', '') or '').lower()
    groups = _user_group_names(user)
    return role in {'admin', 'super_admin'} or bool({'admin'} & groups)


def is_hall_booking_authorized_user(user):
    """Only Principal/Director/HOD/Admin can use hall booking module."""
    if not getattr(user, 'is_authenticated', False):
        return False
    role = (getattr(user, 'role', '') or '').lower()
    groups = _user_group_names(user)

    if role == 'student':
        return False

    allowed_roles = {'admin', 'super_admin', 'principal', 'director', 'hod', 'pd', 'staff'}
    allowed_groups = {'principal', 'director', 'hod', 'admin', 'pd', 'staff'}
    return role in allowed_roles or bool(allowed_groups & groups)


def can_request_hall(user):
    if not getattr(user, 'is_authenticated', False):
        return False
    role = (getattr(user, 'role', '') or '').lower()
    if role == 'student':
        return False
    return role in {'admin', 'super_admin', 'principal', 'director', 'hod', 'pd', 'staff'}


def can_approve_hall(user):
    if not getattr(user, 'is_authenticated', False):
        return False
    role = (getattr(user, 'role', '') or '').lower()
    groups = _user_group_names(user)
    allowed_roles = {'admin', 'super_admin', 'principal', 'director'}
    allowed_groups = {'admin', 'principal', 'director'}
    return role in allowed_roles or bool(allowed_groups & groups)


class HallViewSet(viewsets.ModelViewSet):
    """Manage halls (Auditorium, Seminar halls, Conference rooms)."""

    queryset = Hall.objects.filter(is_active=True)
    serializer_class = HallSerializer
    permission_classes = [IsAuthenticated]

    def _check_module_access(self, request):
        if not is_hall_booking_authorized_user(request.user):
            return Response({'error': 'You are not authorized to access hall booking.'}, status=403)
        return None

    def get_permissions(self):
        return [permission() for permission in self.permission_classes]

    def list(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can create halls.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can update halls.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can delete halls.'}, status=403)
        hall = self.get_object()
        hall.is_active = False
        hall.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class HallSlotViewSet(viewsets.ModelViewSet):
    """Hall slot configuration (admin managed)."""

    queryset = HallSlot.objects.select_related('hall').filter(is_active=True, hall__is_active=True)
    serializer_class = HallSlotSerializer
    permission_classes = [IsAuthenticated]

    def _check_module_access(self, request):
        if not is_hall_booking_authorized_user(request.user):
            return Response({'error': 'You are not authorized to access hall booking.'}, status=403)
        return None

    def list(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        qs = self.get_queryset()
        hall_id = request.query_params.get('hall')
        if hall_id:
            qs = qs.filter(hall_id=hall_id)
        return Response(self.get_serializer(qs, many=True).data)

    def create(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can create hall slots.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can update hall slots.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can delete hall slots.'}, status=403)
        slot = self.get_object()
        slot.is_active = False
        slot.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class HallEquipmentViewSet(viewsets.ModelViewSet):
    """Equipment catalog for hall bookings."""

    queryset = HallEquipment.objects.filter(is_active=True)
    serializer_class = HallEquipmentSerializer
    permission_classes = [IsAuthenticated]

    def _check_module_access(self, request):
        if not is_hall_booking_authorized_user(request.user):
            return Response({'error': 'You are not authorized to access hall booking.'}, status=403)
        return None

    def list(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can manage equipment.'}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can manage equipment.'}, status=403)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can manage equipment.'}, status=403)
        equipment = self.get_object()
        equipment.is_active = False
        equipment.save(update_fields=['is_active', 'updated_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class HallBookingViewSet(viewsets.ModelViewSet):
    """Booking workflow with conflict prevention and approval."""

    serializer_class = HallBookingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        today = timezone.localdate()

        qs = HallBooking.objects.select_related('hall', 'requester', 'reviewed_by').filter(
            booking_date__gte=today
        )

        if can_approve_hall(user):
            return qs

        return qs.filter(requester=user)

    def _check_module_access(self, request):
        if not is_hall_booking_authorized_user(request.user):
            return Response({'error': 'You are not authorized to access hall booking.'}, status=403)
        return None

    def list(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied

        if not can_request_hall(request.user):
            return Response({'error': 'You are not allowed to request hall bookings.'}, status=403)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(requester=request.user)
        self._send_submission_notification(serializer.instance)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied

        booking = self.get_object()
        if booking.status != HallBooking.STATUS_PENDING:
            return Response({'error': 'Only pending bookings can be edited.'}, status=400)

        if not is_hall_admin_user(request.user) and booking.requester_id != request.user.id:
            return Response({'error': 'You cannot edit this booking.'}, status=403)

        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        denied = self._check_module_access(request)
        if denied:
            return denied

        booking = self.get_object()
        if not is_hall_admin_user(request.user) and booking.requester_id != request.user.id:
            return Response({'error': 'You cannot cancel this booking.'}, status=403)
        if booking.status == HallBooking.STATUS_CANCELLED:
            return Response({'error': 'Booking is already cancelled.'}, status=400)

        booking.status = HallBooking.STATUS_CANCELLED
        booking.cancelled_at = timezone.now()
        booking.reviewed_by = request.user if is_hall_admin_user(request.user) else booking.reviewed_by
        booking.review_note = request.data.get('review_note', booking.review_note)
        booking.reviewed_at = timezone.now() if is_hall_admin_user(request.user) else booking.reviewed_at
        booking.save(
            update_fields=[
                'status',
                'cancelled_at',
                'reviewed_by',
                'review_note',
                'reviewed_at',
                'updated_at',
            ]
        )
        self._send_cancel_notification(booking)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a pending booking request."""
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not can_approve_hall(request.user):
            return Response({'error': 'Only admin/principal/director can approve bookings.'}, status=403)

        booking = self.get_object()
        if booking.status != HallBooking.STATUS_PENDING:
            return Response({'error': 'Only pending bookings can be approved.'}, status=400)

        booking.status = HallBooking.STATUS_APPROVED
        booking.reviewed_by = request.user
        booking.review_note = request.data.get('review_note', '')
        booking.reviewed_at = timezone.now()
        booking.save(update_fields=['status', 'reviewed_by', 'review_note', 'reviewed_at', 'updated_at'])

        self._send_approval_notifications(booking)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a pending booking request."""
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not can_approve_hall(request.user):
            return Response({'error': 'Only admin/principal/director can reject bookings.'}, status=403)

        booking = self.get_object()
        if booking.status != HallBooking.STATUS_PENDING:
            return Response({'error': 'Only pending bookings can be rejected.'}, status=400)

        booking.status = HallBooking.STATUS_REJECTED
        booking.reviewed_by = request.user
        booking.review_note = request.data.get('review_note', '')
        booking.reviewed_at = timezone.now()
        booking.save(update_fields=['status', 'reviewed_by', 'review_note', 'reviewed_at', 'updated_at'])

        self._send_rejection_notification(booking)
        return Response(self.get_serializer(booking).data)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Dashboard for today bookings, upcoming bookings, and pending approvals."""
        denied = self._check_module_access(request)
        if denied:
            return denied

        today = timezone.localdate()
        base_qs = HallBooking.objects.select_related('hall', 'requester').filter(booking_date__gte=today)

        if not can_approve_hall(request.user):
            base_qs = base_qs.filter(requester=request.user)

        today_bookings = base_qs.filter(booking_date=today).order_by('start_time')
        upcoming_bookings = base_qs.filter(booking_date__gt=today).order_by('booking_date', 'start_time')
        pending_qs = base_qs.filter(status=HallBooking.STATUS_PENDING).order_by('booking_date', 'start_time')

        total_halls = Hall.objects.filter(is_active=True, status='open').count()
        approved_today = today_bookings.filter(status=HallBooking.STATUS_APPROVED).count()
        available_halls = max(total_halls - approved_today, 0)
        hall_utilization = round((approved_today / total_halls) * 100, 2) if total_halls else 0.0

        return Response({
            'bookings_today_count': today_bookings.count(),
            'pending_requests_count': pending_qs.count(),
            'available_halls_count': available_halls,
            'hall_utilization_percent': hall_utilization,
            'today_bookings': HallBookingSerializer(today_bookings, many=True).data,
            'upcoming_bookings': HallBookingSerializer(upcoming_bookings, many=True).data,
            'pending_approvals': HallBookingSerializer(pending_qs, many=True).data,
        })

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """Calendar/schedule grouped by hall for a selected date."""
        denied = self._check_module_access(request)
        if denied:
            return denied

        date_str = request.query_params.get('date')
        selected_date = timezone.localdate()
        if date_str:
            try:
                selected_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=400)

        hall_id = request.query_params.get('hall_id')
        qs = HallBooking.objects.select_related('hall', 'requester').filter(booking_date=selected_date)
        if hall_id:
            qs = qs.filter(hall_id=hall_id)

        if not can_approve_hall(request.user):
            qs = qs.filter(requester=request.user)

        schedule_by_hall = defaultdict(list)
        for booking in qs.order_by('hall__hall_name', 'start_time'):
            schedule_by_hall[booking.hall.hall_name].append(
                {
                    'id': booking.id,
                    'event_name': booking.event_name,
                    'department': booking.department,
                    'start_time': booking.start_time.strftime('%H:%M'),
                    'end_time': booking.end_time.strftime('%H:%M'),
                    'status': booking.status,
                    'requester_name': booking.requester.get_full_name() or booking.requester.username,
                }
            )

        return Response(
            {
                'date': selected_date.isoformat(),
                'schedule': schedule_by_hall,
            }
        )

    @action(detail=True, methods=['get'])
    def qr(self, request, pk=None):
        """Get hall booking QR token payload for optional attendance."""
        denied = self._check_module_access(request)
        if denied:
            return denied
        booking = self.get_object()
        if not can_approve_hall(request.user) and booking.requester_id != request.user.id:
            return Response({'error': 'You cannot access this booking QR payload.'}, status=403)
        return Response(
            {
                'booking_id': booking.id,
                'event_name': booking.event_name,
                'hall_name': booking.hall.hall_name,
                'booking_date': booking.booking_date,
                'start_time': booking.start_time,
                'end_time': booking.end_time,
                'qr_token': str(booking.qr_token),
            }
        )

    @action(detail=True, methods=['post'])
    def check_in(self, request, pk=None):
        """Record attendee check-in using QR/manual mode."""
        denied = self._check_module_access(request)
        if denied:
            return denied
        booking = self.get_object()
        if booking.status != HallBooking.STATUS_APPROVED:
            return Response({'error': 'Only approved events can record attendance.'}, status=400)
        if not can_approve_hall(request.user):
            return Response({'error': 'Only admin/principal/director can record attendance.'}, status=403)

        attendee_name = (request.data.get('attendee_name') or '').strip()
        attendee_identifier = (request.data.get('attendee_identifier') or '').strip()
        scan_method = request.data.get('scan_method', HallAttendance.SCAN_QR)

        if not attendee_name:
            return Response({'error': 'attendee_name is required.'}, status=400)
        if scan_method not in {HallAttendance.SCAN_QR, HallAttendance.SCAN_MANUAL}:
            return Response({'error': 'scan_method must be qr or manual.'}, status=400)

        record = HallAttendance.objects.create(
            booking=booking,
            attendee_name=attendee_name,
            attendee_identifier=attendee_identifier,
            scan_method=scan_method,
            scanned_by=request.user,
        )
        return Response(HallAttendanceSerializer(record).data, status=201)

    @action(detail=True, methods=['get'])
    def attendance(self, request, pk=None):
        """List attendance records for a booking."""
        denied = self._check_module_access(request)
        if denied:
            return denied
        booking = self.get_object()
        if not can_approve_hall(request.user) and booking.requester_id != request.user.id:
            return Response({'error': 'You cannot access attendance for this booking.'}, status=403)
        records = booking.attendance_records.select_related('scanned_by').all()
        return Response(HallAttendanceSerializer(records, many=True).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Explicit cancel endpoint for workflow UI."""
        return self.destroy(request, pk=pk)

    def _send_submission_notification(self, booking):
        notify_user(
            booking.requester,
            'Hall request submitted',
            f"Your hall booking request for {booking.hall.hall_name} on {booking.booking_date} is submitted.",
            'info',
            action_url='/hall-booking',
        )

    def _send_approval_notifications(self, booking):
        hall = booking.hall
        slot = f"{booking.booking_date} {booking.start_time.strftime('%H:%M')}-{booking.end_time.strftime('%H:%M')}"

        notify_user(
            booking.requester,
            'Hall booking approved',
            f"Your booking for {hall.hall_name} ({slot}) has been approved.",
            'success',
            action_url='/hall-booking',
        )

        if hall.manager and hall.manager_id != booking.requester_id:
            notify_user(
                hall.manager,
                'Hall booking approved',
                f"Booking approved: {booking.event_name} at {hall.hall_name} ({slot}).",
                'info',
                action_url='/hall-booking',
            )

    def _send_rejection_notification(self, booking):
        hall = booking.hall
        slot = f"{booking.booking_date} {booking.start_time.strftime('%H:%M')}-{booking.end_time.strftime('%H:%M')}"
        note = f" Note: {booking.review_note}" if booking.review_note else ''

        notify_user(
            booking.requester,
            'Hall booking rejected',
            f"Your booking for {hall.hall_name} ({slot}) was rejected.{note}",
            'warning',
            action_url='/hall-booking',
        )

    def _send_cancel_notification(self, booking):
        hall = booking.hall
        slot = f"{booking.booking_date} {booking.start_time.strftime('%H:%M')}-{booking.end_time.strftime('%H:%M')}"
        notify_user(
            booking.requester,
            'Hall booking cancelled',
            f"Booking for {hall.hall_name} ({slot}) has been cancelled.",
            'warning',
            action_url='/hall-booking',
        )
