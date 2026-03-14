"""
ViewSets for the sports module.

Permission matrix
─────────────────
SportViewSet            list/retrieve: everyone  create/update/destroy: MANAGE_ROLES
SportCourtViewSet       list/retrieve: everyone  create/update/destroy: MANAGE_ROLES
CourtSlotViewSet        list/retrieve: everyone  create/update/destroy: MANAGE_ROLES
SportsPolicyViewSet     list/retrieve: everyone  create/update: MANAGE_ROLES
SportBookingViewSet     list: scoped by role      create: students (+ policy enforcement)
                        check_in / verify_qr: PT+  destroy (cancel): own student or MANAGE_ROLES
DepartmentSportsRequestViewSet
                        list: HOD sees own, PD/Admin see all
                        create: HOD_ROLES
                        approve / reject: MANAGE_ROLES
"""

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import ROLE_HOD, ROLE_PT, ROLE_STUDENT

from .models import (
    CourtSlot,
    DepartmentSportsRequest,
    Sport,
    SportAttendance,
    SportBooking,
    SportCourt,
    SportsPolicy,
)
from .serializers import (
    CourtSlotSerializer,
    DepartmentSportsRequestSerializer,
    SportAttendanceSerializer,
    SportBookingSerializer,
    SportCourtSerializer,
    SportSerializer,
    SportsPolicySerializer,
)

# ─── Role helpers ──────────────────────────────────────────────────────────────

MANAGE_ROLES = ['pd', 'admin', 'super_admin']
PT_ROLES = ['pt', 'pd', 'admin', 'super_admin']
HOD_ROLES = ['hod', 'pd', 'admin', 'super_admin']


def _is_manager(user):
    return getattr(user, 'role', None) in MANAGE_ROLES or getattr(user, 'is_superuser', False)


def _is_pt_or_above(user):
    return getattr(user, 'role', None) in PT_ROLES or getattr(user, 'is_superuser', False)


def _require_manager(user):
    if not _is_manager(user):
        raise PermissionDenied("Only PD or Admin can perform this action.")


def _require_pt(user):
    if not _is_pt_or_above(user):
        raise PermissionDenied("Only PT/PD or Admin can perform this action.")


# ─── Sports ────────────────────────────────────────────────────────────────────

class SportViewSet(viewsets.ModelViewSet):
    """Sport definitions (Badminton, Cricket …). PD/Admin manage; everyone reads."""
    queryset = Sport.objects.all()
    serializer_class = SportSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        _require_manager(request.user)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        _require_manager(request.user)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        _require_manager(request.user)
        return super().destroy(request, *args, **kwargs)


# ─── Courts ────────────────────────────────────────────────────────────────────

class SportCourtViewSet(viewsets.ModelViewSet):
    """Courts and grounds. PD/Admin manage; everyone reads."""
    queryset = SportCourt.objects.select_related('sport').all()
    serializer_class = SportCourtSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['sport', 'status']

    def create(self, request, *args, **kwargs):
        _require_manager(request.user)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        _require_manager(request.user)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        _require_manager(request.user)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='today-slots')
    def today_slots(self, request, pk=None):
        court = self.get_object()
        today = timezone.localdate()
        slots = CourtSlot.objects.filter(court=court, date=today).order_by('start_time')
        return Response(CourtSlotSerializer(slots, many=True).data)


# ─── Slots ─────────────────────────────────────────────────────────────────────

class CourtSlotViewSet(viewsets.ModelViewSet):
    """Time slots on courts. PD/Admin create; everyone reads."""
    serializer_class = CourtSlotSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['court', 'date']

    def get_queryset(self):
        qs = CourtSlot.objects.select_related('court', 'court__sport')
        params = self.request.query_params
        if date_p := params.get('date'):
            qs = qs.filter(date=date_p)
        if sport_p := params.get('sport'):
            qs = qs.filter(court__sport_id=sport_p)
        if params.get('upcoming'):
            qs = qs.filter(date__gte=timezone.localdate())
        return qs.order_by('date', 'start_time')

    def create(self, request, *args, **kwargs):
        _require_manager(request.user)
        court = request.data.get('court')
        date = request.data.get('date')
        start = request.data.get('start_time')
        end = request.data.get('end_time')
        if court and date and start and end:
            overlap = CourtSlot.objects.filter(
                court_id=court, date=date
            ).filter(
                Q(start_time__lt=end) & Q(end_time__gt=start)
            )
            if overlap.exists():
                return Response(
                    {'detail': 'This slot overlaps with an existing slot for this court.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        _require_manager(request.user)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        _require_manager(request.user)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='today-schedule')
    def today_schedule(self, request):
        today = timezone.localdate()
        slots = (
            CourtSlot.objects
            .select_related('court', 'court__sport')
            .filter(date=today)
            .order_by('start_time')
        )
        return Response(CourtSlotSerializer(slots, many=True).data)

    @action(detail=False, methods=['get'], url_path='upcoming')
    def upcoming_slots(self, request):
        qs = (
            CourtSlot.objects
            .select_related('court', 'court__sport')
            .filter(date__gte=timezone.localdate())
            .order_by('date', 'start_time')
        )
        sport_id = self.request.query_params.get('sport')
        if sport_id:
            qs = qs.filter(court__sport_id=sport_id)
        return Response(CourtSlotSerializer(qs, many=True).data)


# ─── Policy ────────────────────────────────────────────────────────────────────

class SportsPolicyViewSet(viewsets.ModelViewSet):
    """Singleton sports policy. PD/Admin manage; everyone can read."""
    queryset = SportsPolicy.objects.all()
    serializer_class = SportsPolicySerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        _require_manager(request.user)
        if SportsPolicy.objects.exists():
            return Response(
                {'detail': 'A policy already exists. Use PATCH to update it.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        _require_manager(request.user)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        _require_manager(request.user)
        return super().destroy(request, *args, **kwargs)


# ─── Bookings ──────────────────────────────────────────────────────────────────

class SportBookingViewSet(viewsets.ModelViewSet):
    """
    Student slot bookings with QR-based attendance.

    create  → student books a slot (enforces policy)
    destroy → student cancels own booking
    check_in (POST, detail=False) → PT scans qr_token → marks attended
    verify_qr (POST, detail=False) → PT previews booking before check-in
    my_upcoming (GET, detail=False) → student's own upcoming bookings
    """
    serializer_class = SportBookingSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = SportBooking.objects.select_related(
            'slot', 'slot__court', 'slot__court__sport', 'student'
        )
        if _is_pt_or_above(user):
            if date_p := self.request.query_params.get('date'):
                qs = qs.filter(slot__date=date_p)
            return qs
        return qs.filter(student=user)

    def create(self, request, *args, **kwargs):
        user = request.user
        slot_id = request.data.get('slot')
        if not slot_id:
            return Response({'detail': 'slot is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            slot = CourtSlot.objects.select_related('court__sport').get(pk=slot_id)
        except CourtSlot.DoesNotExist:
            return Response({'detail': 'Slot not found.'}, status=status.HTTP_404_NOT_FOUND)

        if slot.court.status != 'open':
            return Response(
                {'detail': f'Court is currently {slot.court.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Duplicate booking check
        if SportBooking.objects.filter(
            slot=slot, student=user, status__in=['confirmed', 'attended']
        ).exists():
            return Response(
                {'detail': 'You already have a booking for this slot.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Slot full?
        if slot.bookings.filter(status__in=['confirmed', 'attended']).count() >= slot.max_players:
            return Response({'detail': 'This slot is full.'}, status=status.HTTP_400_BAD_REQUEST)

        # Policy enforcement
        policy = SportsPolicy.objects.first()
        if policy:
            today = timezone.localdate()

            daily_ct = SportBooking.objects.filter(
                student=user, slot__date=today, status__in=['confirmed', 'attended']
            ).count()
            if daily_ct >= policy.max_bookings_per_day:
                return Response(
                    {'detail': f"Daily booking limit ({policy.max_bookings_per_day}) reached."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            week_start = today - timedelta(days=today.weekday())
            week_ct = SportBooking.objects.filter(
                student=user, slot__date__gte=week_start, status__in=['confirmed', 'attended']
            ).count()
            if week_ct >= policy.max_bookings_per_week:
                return Response(
                    {'detail': f"Weekly booking limit ({policy.max_bookings_per_week}) reached."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if not policy.allow_same_sport_same_day:
                sport_today = SportBooking.objects.filter(
                    student=user,
                    slot__date=today,
                    slot__court__sport=slot.court.sport,
                    status__in=['confirmed', 'attended'],
                ).count()
                if sport_today > 0:
                    return Response(
                        {'detail': 'You already have a booking for this sport today.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            # Booking window check
            days_ahead = (slot.date - today).days
            if days_ahead < 0 or days_ahead > policy.booking_window_days:
                return Response(
                    {'detail': f"Bookings are only allowed up to {policy.booking_window_days} days in advance."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        booking = SportBooking.objects.create(slot=slot, student=user)
        return Response(SportBookingSerializer(booking).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        booking = self.get_object()
        if booking.student != request.user and not _is_manager(request.user):
            raise PermissionDenied("You can only cancel your own bookings.")
        if booking.status == 'attended':
            return Response(
                {'detail': 'Cannot cancel an already attended booking.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        booking.status = 'cancelled'
        booking.save()
        return Response({'detail': 'Booking cancelled.'})

    @action(detail=False, methods=['post'], url_path='verify-qr')
    def verify_qr(self, request):
        """Preview booking details from a QR token (read-only, no check-in)."""
        qr_token = request.data.get('qr_token')
        if not qr_token:
            return Response({'detail': 'qr_token is required.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            booking = SportBooking.objects.select_related(
                'student', 'slot', 'slot__court', 'slot__court__sport'
            ).get(qr_token=qr_token)
        except SportBooking.DoesNotExist:
            return Response({'detail': 'Invalid QR code.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SportBookingSerializer(booking).data)

    @action(detail=False, methods=['get'], url_path='student-search')
    def student_search(self, request):
        """Manual fallback: find students with confirmed bookings today (PT only)."""
        _require_pt(request.user)
        query = request.query_params.get('q', '').strip()
        if not query or len(query) < 2:
            return Response([])
        today = timezone.localdate()
        from django.db.models import Q
        bookings = (
            SportBooking.objects
            .select_related('student', 'slot', 'slot__court', 'slot__court__sport')
            .filter(slot__date=today, status='confirmed')
            .filter(
                Q(student__first_name__icontains=query) |
                Q(student__last_name__icontains=query) |
                Q(student__registration_number__icontains=query) |
                Q(student__username__icontains=query)
            )[:10]
        )
        results = []
        for b in bookings:
            s = b.student
            results.append({
                'booking_id': b.id,
                'student_id': s.id,
                'name': s.get_full_name() or s.username,
                'registration_number': getattr(s, 'registration_number', ''),
                'sport': b.slot.court.sport.name,
                'court': b.slot.court.name,
                'time': f"{b.slot.start_time.strftime('%I:%M %p')} – {b.slot.end_time.strftime('%I:%M %p')}",
            })
        return Response(results)

    @action(detail=False, methods=['post'], url_path='check-in')
    def check_in(self, request):
        """
        PT check-in: QR mode (qr_token) or Manual mode (student_id).
        Records scan_method on the booking for audit logging.
        """
        _require_pt(request.user)
        qr_token = request.data.get('qr_token')
        student_id = request.data.get('student_id')
        scan_method = 'qr' if qr_token else 'manual'

        if not qr_token and not student_id:
            return Response(
                {'detail': 'Either qr_token (QR scan) or student_id (manual) is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if qr_token:
            try:
                booking = SportBooking.objects.select_related(
                    'student', 'slot', 'slot__court', 'slot__court__sport'
                ).get(qr_token=qr_token)
            except SportBooking.DoesNotExist:
                return Response({'detail': 'Invalid QR code.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            # Manual: find the student's confirmed booking for today
            today = timezone.localdate()
            booking = (
                SportBooking.objects
                .select_related('student', 'slot', 'slot__court', 'slot__court__sport')
                .filter(student_id=student_id, slot__date=today, status='confirmed')
                .order_by('slot__start_time')
                .first()
            )
            if not booking:
                return Response(
                    {'detail': 'No active booking found for this student today.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        if booking.status == 'cancelled':
            return Response(
                {'detail': 'This booking has been cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if booking.status == 'attended':
            return Response({
                'detail': 'Student already checked in.',
                'booking': SportBookingSerializer(booking).data,
            })

        booking.status = 'attended'
        booking.check_in_time = timezone.now()
        booking.checked_in_by = request.user
        booking.scan_method = scan_method
        booking.save()

        SportAttendance.objects.get_or_create(
            booking=booking,
            defaults={'scanned_by': request.user},
        )

        return Response({
            'detail': 'Check-in successful.',
            'booking': SportBookingSerializer(booking).data,
        })

    @action(detail=False, methods=['get'], url_path='my-upcoming')
    def my_upcoming(self, request):
        """Return the authenticated student's upcoming confirmed bookings."""
        today = timezone.localdate()
        bookings = (
            SportBooking.objects
            .select_related('slot', 'slot__court', 'slot__court__sport')
            .filter(student=request.user, slot__date__gte=today, status='confirmed')
            .order_by('slot__date', 'slot__start_time')
        )
        return Response(SportBookingSerializer(bookings, many=True).data)


# ─── Department Sports Requests ────────────────────────────────────────────────

class DepartmentSportsRequestViewSet(viewsets.ModelViewSet):
    """
    HOD submits a class sports request.  PD approves it and allocates a CourtSlot.
    """
    serializer_class = DepartmentSportsRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = DepartmentSportsRequest.objects.select_related(
            'requesting_hod', 'sport', 'preferred_court', 'reviewed_by', 'allocated_slot'
        )
        if _is_manager(user):
            return qs
        if getattr(user, 'role', None) == ROLE_HOD:
            return qs.filter(requesting_hod=user)
        return qs.none()

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) not in HOD_ROLES:
            raise PermissionDenied("Only HOD can submit class sports requests.")
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(requesting_hod=self.request.user)

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        _require_manager(request.user)
        req = self.get_object()
        if req.status != 'pending':
            return Response(
                {'detail': 'Only pending requests can be approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        court_id = request.data.get('court_id')
        if not court_id:
            return Response(
                {'detail': 'court_id is required for approval.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            court = SportCourt.objects.get(pk=court_id)
        except SportCourt.DoesNotExist:
            return Response({'detail': 'Court not found.'}, status=status.HTTP_404_NOT_FOUND)

        slot = CourtSlot.objects.create(
            court=court,
            date=req.requested_date,
            start_time=req.requested_start_time,
            end_time=req.requested_end_time,
            max_players=req.estimated_players,
            notes=f"Auto-created for dept request: {req.title}",
        )
        req.status = 'approved'
        req.reviewed_by = request.user
        req.allocated_slot = slot
        req.save()
        return Response(DepartmentSportsRequestSerializer(req).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        _require_manager(request.user)
        req = self.get_object()
        if req.status != 'pending':
            return Response(
                {'detail': 'Only pending requests can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        req.status = 'rejected'
        req.reviewed_by = request.user
        req.rejection_reason = request.data.get('reason', '')
        req.save()
        return Response(DepartmentSportsRequestSerializer(req).data)

    @action(detail=False, methods=['get'], url_path='pd-dashboard')
    def pd_dashboard(self, request):
        """PD/Admin overview dashboard: today's counts."""
        _require_manager(request.user)
        today = timezone.localdate()

        bookings_today = SportBooking.objects.filter(
            slot__date=today, status__in=['confirmed', 'attended']
        ).count()
        active_players = SportBooking.objects.filter(
            slot__date=today, status='attended'
        ).count()
        courts_active = (
            CourtSlot.objects.filter(date=today)
            .values('court')
            .distinct()
            .count()
        )
        match_ready = sum(
            1 for s in CourtSlot.objects.filter(date=today) if s.is_match_ready
        )
        pending_requests = DepartmentSportsRequest.objects.filter(status='pending').count()

        # Sport popularity (last 30 days)
        from datetime import date
        thirty_ago = today - timedelta(days=30)
        by_sport = (
            SportBooking.objects
            .filter(created_at__date__gte=thirty_ago, status__in=['confirmed', 'attended'])
            .values('slot__court__sport__name')
            .annotate(count=Count('id'))
            .order_by('-count')[:5]
        )

        return Response({
            'bookings_today': bookings_today,
            'active_players': active_players,
            'courts_active': courts_active,
            'match_ready': match_ready,
            'pending_requests': pending_requests,
            'popular_sports': list(by_sport),
        })
