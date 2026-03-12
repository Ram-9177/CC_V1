"""Views for hall booking module."""

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notifications.utils import notify_user

from .models import Hall, HallBooking
from .serializers import HallSerializer, HallBookingSerializer


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

    allowed_roles = {'admin', 'super_admin', 'principal', 'director', 'hod'}
    allowed_groups = {'principal', 'director', 'hod', 'admin'}
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

        if is_hall_admin_user(user):
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

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(requester=request.user)
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

        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a pending booking request."""
        denied = self._check_module_access(request)
        if denied:
            return denied
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can approve bookings.'}, status=403)

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
        if not is_hall_admin_user(request.user):
            return Response({'error': 'Only admin can reject bookings.'}, status=403)

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

        if not is_hall_admin_user(request.user):
            base_qs = base_qs.filter(requester=request.user)

        today_bookings = base_qs.filter(booking_date=today).order_by('start_time')
        upcoming_bookings = base_qs.filter(booking_date__gt=today).order_by('booking_date', 'start_time')
        pending_qs = base_qs.filter(status=HallBooking.STATUS_PENDING).order_by('booking_date', 'start_time')

        return Response({
            'today_bookings': HallBookingSerializer(today_bookings, many=True).data,
            'upcoming_bookings': HallBookingSerializer(upcoming_bookings, many=True).data,
            'pending_approvals': HallBookingSerializer(pending_qs, many=True).data,
        })

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
