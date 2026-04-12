"""Frontend-compatible Sports API layer.

This file provides the rich Sports module contracts expected by frontend pages:
- /sports/sports/
- /sports/courts/
- /sports/slots/
- /sports/policy/
- /sports/bookings/
- /sports/dept-requests/
- /sports/facilities/ (compat alias used by legacy FE views)
"""

from datetime import timedelta

from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone
from rest_framework import permissions, status as http_status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.auth.models import User
from core.digital_qr import DigitalQRValidationError, resolve_user_from_digital_qr
from core.college_mixin import CollegeScopeMixin
from .models import (
    CourtSlot,
    DepartmentSportsRequest,
    Sport,
    SportAttendance,
    SportCourt,
    SportEquipment,
    SportEquipmentIssue,
    SportsPolicy,
    SportSlotBooking,
)
from .serializers import (
    CourtSlotSerializer,
    DepartmentSportsRequestSerializer,
    SportCourtSerializer,
    SportEquipmentIssueSerializer,
    SportEquipmentSerializer,
    SportsPolicySerializer,
    SportSerializer,
    SportSlotBookingSerializer,
)


SPORTS_MANAGEMENT_ROLES = {'pt', 'pd', 'admin', 'super_admin'}
SPORTS_REQUEST_CREATOR_ROLES = SPORTS_MANAGEMENT_ROLES | {'hod'}
SPORTS_SCANNER_ROLES = SPORTS_MANAGEMENT_ROLES | {'gate_security', 'security_head'}


def _role(user):
    return getattr(user, 'role', '')


def _is_super_admin(user):
    return _role(user) == 'super_admin' or getattr(user, 'is_superuser', False)


def _is_management(user):
    return _role(user) in SPORTS_MANAGEMENT_ROLES


def _can_scan(user):
    return _role(user) in SPORTS_SCANNER_ROLES


def _ensure_management(user):
    if not _is_management(user):
        raise PermissionDenied('Only PT/PD/Admin can perform this action.')


def _scope_queryset(queryset, user):
    if _is_super_admin(user):
        return queryset

    college = getattr(user, 'college', None)
    if college is None:
        return queryset.none()

    return queryset.filter(college=college)


def _ensure_same_college(user, obj, label):
    if _is_super_admin(user):
        return

    user_college = getattr(user, 'college', None)
    obj_college_id = getattr(obj, 'college_id', None)

    if user_college is None:
        if obj_college_id is None:
            return
        raise ValidationError('User is not mapped to a college.')

    if obj_college_id != user_college.id:
        raise PermissionDenied(f'Selected {label} is outside your college scope.')


def _is_truthy(value):
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def _resolve_user_lookup(user, lookup):
    normalized_lookup = (lookup or '').strip()
    if not normalized_lookup:
        raise ValidationError({'issued_to_lookup': 'This field is required.'})

    users = User.objects.all()
    if not _is_super_admin(user):
        college = getattr(user, 'college', None)
        if college is None:
            users = users.filter(college__isnull=True)
        else:
            users = users.filter(college=college)

    issued_to = users.filter(
        Q(registration_number__iexact=normalized_lookup) | Q(username__iexact=normalized_lookup)
    ).first()
    if issued_to is None:
        raise ValidationError({'issued_to_lookup': 'No user found for that registration number or username.'})

    return issued_to


class SportsManagementOnlyMixin:
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        _ensure_management(request.user)


class SportsCatalogViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    queryset = Sport.objects.all()
    serializer_class = SportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        _ensure_management(self.request.user)
        serializer.save(college=getattr(self.request.user, 'college', None))

    def perform_update(self, serializer):
        _ensure_management(self.request.user)
        serializer.save()

    def perform_destroy(self, instance):
        _ensure_management(self.request.user)
        instance.delete()


class SportCourtViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    queryset = SportCourt.objects.select_related('sport').all()
    serializer_class = SportCourtSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        sport_id = self.request.query_params.get('sport')
        status_filter = self.request.query_params.get('status')

        if sport_id:
            qs = qs.filter(sport_id=sport_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        _ensure_management(self.request.user)
        sport = serializer.validated_data['sport']
        _ensure_same_college(self.request.user, sport, 'sport')
        serializer.save(college=sport.college or getattr(self.request.user, 'college', None))

    def perform_update(self, serializer):
        _ensure_management(self.request.user)
        sport = serializer.validated_data.get('sport', serializer.instance.sport)
        _ensure_same_college(self.request.user, sport, 'sport')
        serializer.save(college=sport.college or getattr(self.request.user, 'college', None))

    def perform_destroy(self, instance):
        _ensure_management(self.request.user)
        instance.delete()


class CourtSlotViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    queryset = CourtSlot.objects.select_related('court', 'court__sport').all()
    serializer_class = CourtSlotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        court_id = self.request.query_params.get('court')
        upcoming = self.request.query_params.get('upcoming')

        if court_id:
            qs = qs.filter(court_id=court_id)
        if upcoming in {'1', 'true', 'True'}:
            qs = qs.filter(date__gte=timezone.localdate())

        return qs

    def perform_create(self, serializer):
        _ensure_management(self.request.user)
        court = serializer.validated_data['court']
        _ensure_same_college(self.request.user, court, 'court')
        serializer.save(college=court.college or getattr(self.request.user, 'college', None))

    def perform_update(self, serializer):
        _ensure_management(self.request.user)
        court = serializer.validated_data.get('court', serializer.instance.court)
        _ensure_same_college(self.request.user, court, 'court')
        serializer.save(college=court.college or getattr(self.request.user, 'college', None))

    def perform_destroy(self, instance):
        _ensure_management(self.request.user)
        instance.delete()

    @action(detail=False, methods=['get'], url_path='today-schedule')
    def today_schedule(self, request):
        qs = self.get_queryset().filter(date=timezone.localdate())
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class SportsPolicyViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    queryset = SportsPolicy.objects.all()
    serializer_class = SportsPolicySerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        _ensure_management(request.user)

        college = getattr(request.user, 'college', None)
        if not _is_super_admin(request.user) and college is None:
            raise ValidationError('User is not mapped to a college.')

        policy = SportsPolicy.objects.filter(college=college).first()
        serializer = self.get_serializer(policy, data=request.data, partial=policy is not None)
        serializer.is_valid(raise_exception=True)
        serializer.save(college=college)

        status_code = http_status.HTTP_200_OK if policy else http_status.HTTP_201_CREATED
        return Response(serializer.data, status=status_code)

    def perform_update(self, serializer):
        _ensure_management(self.request.user)
        serializer.save()

    def perform_destroy(self, instance):
        _ensure_management(self.request.user)
        instance.delete()


class SportEquipmentViewSet(SportsManagementOnlyMixin, CollegeScopeMixin, viewsets.ModelViewSet):
    queryset = SportEquipment.objects.select_related('sport').all()
    serializer_class = SportEquipmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        sport_id = self.request.query_params.get('sport')
        status_filter = self.request.query_params.get('status')
        low_stock = self.request.query_params.get('low_stock')

        if sport_id:
            qs = qs.filter(sport_id=sport_id)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if _is_truthy(low_stock):
            qs = qs.filter(status='available').filter(issued_quantity__gte=F('total_quantity') - F('low_stock_threshold'))

        return qs

    def perform_create(self, serializer):
        sport = serializer.validated_data['sport']
        _ensure_same_college(self.request.user, sport, 'sport')
        serializer.save(college=sport.college or getattr(self.request.user, 'college', None))

    def perform_update(self, serializer):
        sport = serializer.validated_data.get('sport', serializer.instance.sport)
        _ensure_same_college(self.request.user, sport, 'sport')
        serializer.save(college=sport.college or getattr(self.request.user, 'college', None))

    def perform_destroy(self, instance):
        instance.delete()


class SportEquipmentIssueViewSet(SportsManagementOnlyMixin, CollegeScopeMixin, viewsets.ModelViewSet):
    queryset = SportEquipmentIssue.objects.select_related(
        'equipment',
        'equipment__sport',
        'issued_to',
        'issued_by',
        'returned_by',
    ).all()
    serializer_class = SportEquipmentIssueSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        equipment_id = self.request.query_params.get('equipment')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if equipment_id:
            qs = qs.filter(equipment_id=equipment_id)

        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        issued_to = _resolve_user_lookup(request.user, serializer.validated_data.get('issued_to_lookup'))

        with transaction.atomic():
            equipment = (
                SportEquipment.objects.select_for_update()
                .select_related('sport')
                .get(id=serializer.validated_data['equipment'].id)
            )
            _ensure_same_college(request.user, equipment, 'equipment')

            quantity = serializer.validated_data['quantity']
            if equipment.status != 'available':
                raise ValidationError('Equipment is not available for issue.')
            if quantity > equipment.available_quantity:
                raise ValidationError(f'Only {equipment.available_quantity} item(s) are currently available.')

            equipment.issued_quantity += quantity
            equipment.save(update_fields=['issued_quantity', 'updated_at'])

            issue = serializer.save(
                equipment=equipment,
                issued_to=issued_to,
                issued_by=request.user,
                status='issued',
                college=equipment.college or getattr(request.user, 'college', None),
            )

        output = self.get_serializer(issue)
        headers = self.get_success_headers(output.data)
        return Response(output.data, status=http_status.HTTP_201_CREATED, headers=headers)

    @action(detail=True, methods=['post'], url_path='return-item')
    def return_item(self, request, pk=None):
        with transaction.atomic():
            issue = (
                SportEquipmentIssue.objects.select_for_update()
                .select_related('equipment', 'issued_to', 'issued_by', 'returned_by')
                .get(id=self.get_object().id)
            )
            equipment = SportEquipment.objects.select_for_update().get(id=issue.equipment_id)

            if issue.status != 'issued':
                raise ValidationError('This equipment issue is already closed.')

            equipment.issued_quantity = max(equipment.issued_quantity - issue.quantity, 0)
            equipment.save(update_fields=['issued_quantity', 'updated_at'])

            return_note = (request.data.get('notes') or '').strip()
            if return_note:
                issue.notes = '\n'.join(part for part in [issue.notes.strip(), f'Return note: {return_note}'] if part)

            issue.status = 'returned'
            issue.returned_at = timezone.now()
            issue.returned_by = request.user
            issue.save(update_fields=['status', 'returned_at', 'returned_by', 'notes'])

        serializer = self.get_serializer(issue)
        return Response(serializer.data)


class SportSlotBookingViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    queryset = SportSlotBooking.objects.select_related(
        'slot', 'slot__court', 'slot__court__sport', 'student', 'checked_in_by'
    ).all()
    serializer_class = SportSlotBookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if _is_management(user):
            return qs

        return qs.filter(student=user)

    def _get_policy(self, user):
        college = getattr(user, 'college', None)
        return SportsPolicy.objects.filter(college=college).order_by('-updated_at').first()

    def _validate_booking_rules(self, user, slot):
        today = timezone.localdate()
        if slot.date < today:
            raise ValidationError('Cannot book past slots.')

        active_statuses = ['confirmed', 'attended']

        already_in_slot = SportSlotBooking.objects.filter(
            student=user,
            slot=slot,
            status__in=active_statuses,
        ).exists()
        if already_in_slot:
            raise ValidationError('You already booked this slot.')

        # Hard rule: one user cannot hold overlapping active slots.
        has_overlap = SportSlotBooking.objects.filter(
            student=user,
            slot__date=slot.date,
            status__in=active_statuses,
        ).filter(
            slot__start_time__lt=slot.end_time,
            slot__end_time__gt=slot.start_time,
        ).exists()
        if has_overlap:
            raise ValidationError('You already have another booking that overlaps this slot.')

        policy = self._get_policy(user)
        if policy:
            max_date = today + timedelta(days=policy.booking_window_days)
            if slot.date > max_date:
                raise ValidationError('Slot is outside booking window policy.')

        if slot.is_full:
            raise ValidationError('This slot is already full.')

        if policy:
            daily_count = SportSlotBooking.objects.filter(
                student=user,
                slot__date=slot.date,
                status__in=active_statuses,
            ).count()
            if daily_count >= policy.max_bookings_per_day:
                raise ValidationError('Daily booking limit reached.')

            week_start = slot.date - timedelta(days=slot.date.weekday())
            week_end = week_start + timedelta(days=6)
            weekly_count = SportSlotBooking.objects.filter(
                student=user,
                slot__date__range=(week_start, week_end),
                status__in=active_statuses,
            ).count()
            if weekly_count >= policy.max_bookings_per_week:
                raise ValidationError('Weekly booking limit reached.')

            if not policy.allow_same_sport_same_day:
                same_sport = SportSlotBooking.objects.filter(
                    student=user,
                    slot__date=slot.date,
                    slot__court__sport=slot.court.sport,
                    status__in=active_statuses,
                ).exists()
                if same_sport:
                    raise ValidationError('Policy allows only one booking per sport per day.')

    def _validate_waitlist_rules(self, user, slot):
        today = timezone.localdate()
        if slot.date < today:
            raise ValidationError('Cannot join the waitlist for past slots.')

        policy = self._get_policy(user)
        if policy:
            max_date = today + timedelta(days=policy.booking_window_days)
            if slot.date > max_date:
                raise ValidationError('Slot is outside booking window policy.')

        already_in_slot = SportSlotBooking.objects.filter(
            student=user,
            slot=slot,
            status__in=['confirmed', 'attended', 'waitlisted'],
        ).exists()
        if already_in_slot:
            raise ValidationError('You already have a booking or waitlist entry for this slot.')

    def _promote_waitlist(self, slot):
        waitlist = (
            SportSlotBooking.objects.select_for_update()
            .select_related('student', 'slot__court__sport')
            .filter(slot=slot, status='waitlisted')
            .order_by('created_at', 'id')
        )
        for candidate in waitlist:
            try:
                self._validate_booking_rules(candidate.student, slot)
            except ValidationError:
                continue

            candidate.status = 'confirmed'
            candidate.save(update_fields=['status'])
            return candidate

        return None

    def perform_create(self, serializer):
        user = self.request.user
        incoming_slot = serializer.validated_data['slot']
        join_waitlist = _is_truthy(self.request.data.get('join_waitlist'))

        # Lock slot row to avoid overbooking under concurrent requests.
        with transaction.atomic():
            slot = CourtSlot.objects.select_for_update().select_related('court__sport').get(id=incoming_slot.id)
            _ensure_same_college(user, slot, 'slot')

            if slot.is_full and join_waitlist:
                self._validate_waitlist_rules(user, slot)
                serializer.save(
                    student=user,
                    slot=slot,
                    status='waitlisted',
                    college=slot.college or getattr(user, 'college', None),
                )
                return

            self._validate_booking_rules(user, slot)
            serializer.save(
                student=user,
                slot=slot,
                status='confirmed',
                college=slot.college or getattr(user, 'college', None),
            )

    def destroy(self, request, *args, **kwargs):
        booking = self.get_object()
        is_owner = booking.student_id == request.user.id

        if not is_owner and not _is_management(request.user):
            raise PermissionDenied('You can only cancel your own booking.')

        if booking.status in {'attended', 'no_show'} and not _is_management(request.user):
            raise ValidationError('Completed attendance bookings cannot be cancelled.')

        with transaction.atomic():
            locked_booking = (
                SportSlotBooking.objects.select_for_update()
                .select_related('slot__court__sport')
                .get(id=booking.id)
            )
            slot = CourtSlot.objects.select_for_update().select_related('court__sport').get(id=locked_booking.slot_id)
            previous_status = locked_booking.status

            locked_booking.status = 'cancelled'
            locked_booking.save(update_fields=['status'])

            if previous_status == 'confirmed':
                self._promote_waitlist(slot)

        return Response(status=http_status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='my-upcoming')
    def my_upcoming(self, request):
        qs = self.get_queryset().filter(slot__date__gte=timezone.localdate()).exclude(status='cancelled')
        qs = qs.order_by('slot__date', 'slot__start_time')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='check-in')
    def check_in(self, request):
        if not _can_scan(request.user):
            raise PermissionDenied('Only sports/gate personnel can check in students.')

        digital_qr = request.data.get('digital_qr')
        student_id = request.data.get('student_id')
        today = timezone.localdate()

        booking_qs = SportSlotBooking.objects.select_related('student', 'slot__court__sport', 'slot__court')
        booking_qs = _scope_queryset(booking_qs, request.user)

        booking = None
        now = timezone.localtime()
        current_time = now.time()

        def _pick_best_booking(base_qs):
            """Prefer active slot window, then nearest upcoming slot for today."""
            active_now = base_qs.filter(
                slot__start_time__lte=current_time,
                slot__end_time__gte=current_time,
            ).order_by('slot__start_time').first()
            if active_now:
                return active_now
            return base_qs.order_by('slot__start_time').first()

        if digital_qr:
            try:
                resolved_user = resolve_user_from_digital_qr(digital_qr, require_active=True)
            except DigitalQRValidationError as exc:
                raise ValidationError(str(exc)) from exc
            candidate_qs = booking_qs.filter(
                student_id=resolved_user.id,
                slot__date=today,
                status='confirmed',
            )
            booking = _pick_best_booking(candidate_qs)
        elif student_id:
            candidate_qs = booking_qs.filter(
                student_id=student_id,
                slot__date=today,
                status='confirmed',
            )
            booking = _pick_best_booking(candidate_qs)
        else:
            raise ValidationError('digital_qr or student_id is required.')

        if not booking:
            raise ValidationError('No active booking found for check-in.')

        if booking.slot.date != today:
            raise ValidationError('Check-in is allowed only on the booked slot date.')

        if booking.status == 'attended':
            return Response({'detail': 'Already checked in.', 'booking_id': booking.id})

        if booking.status != 'confirmed':
            raise ValidationError('Booking is not in a check-in eligible status.')

        booking.status = 'attended'
        booking.check_in_time = timezone.now()
        booking.checked_in_by = request.user
        booking.save(update_fields=['status', 'check_in_time', 'checked_in_by'])

        SportAttendance.objects.create(
            booking=booking,
            scanned_by=request.user,
            notes=request.data.get('notes', ''),
            college=booking.college,
        )

        return Response(
            {
                'detail': 'Check-in recorded successfully.',
                'booking_id': booking.id,
                'student_name': booking.student.get_full_name().strip() or booking.student.username,
                'sport': booking.slot.court.sport.name,
                'court': booking.slot.court.name,
            },
            status=http_status.HTTP_200_OK,
        )

    @action(detail=False, methods=['get'], url_path='student-search')
    def student_search(self, request):
        if not _can_scan(request.user):
            raise PermissionDenied('Only sports/gate personnel can search students for check-in.')

        query = (request.query_params.get('q') or '').strip()
        today = timezone.localdate()

        qs = SportSlotBooking.objects.select_related('student', 'slot__court__sport', 'slot__court')
        qs = _scope_queryset(qs, request.user)
        qs = qs.filter(slot__date=today, status='confirmed')

        if query:
            qs = qs.filter(
                Q(student__first_name__icontains=query)
                | Q(student__last_name__icontains=query)
                | Q(student__username__icontains=query)
                | Q(student__registration_number__icontains=query)
            )

        qs = qs.order_by('slot__start_time')[:20]
        payload = []
        for booking in qs:
            student = booking.student
            payload.append(
                {
                    'student_id': student.id,
                    'name': student.get_full_name().strip() or student.username,
                    'registration_number': student.registration_number,
                    'sport': booking.slot.court.sport.name,
                    'court': booking.slot.court.name,
                    'time': f"{booking.slot.start_time.strftime('%H:%M')}-{booking.slot.end_time.strftime('%H:%M')}",
                    'booking_id': booking.id,
                }
            )

        return Response(payload)


class DepartmentSportsRequestViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    queryset = DepartmentSportsRequest.objects.select_related(
        'requesting_hod',
        'sport',
        'preferred_court',
        'reviewed_by',
        'allocated_slot',
        'allocated_slot__court',
        'allocated_slot__court__sport',
    ).all()
    serializer_class = DepartmentSportsRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        if _is_management(user):
            return qs
        if _role(user) == 'hod':
            return qs.filter(requesting_hod=user)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if _role(user) not in SPORTS_REQUEST_CREATOR_ROLES:
            raise PermissionDenied('Only HOD/PD/PT/Admin can create department requests.')

        sport = serializer.validated_data['sport']
        _ensure_same_college(user, sport, 'sport')

        preferred_court = serializer.validated_data.get('preferred_court')
        if preferred_court:
            _ensure_same_college(user, preferred_court, 'preferred court')
            if preferred_court.sport_id != sport.id:
                raise ValidationError('Preferred court does not belong to the selected sport.')

        serializer.save(
            requesting_hod=user,
            college=sport.college or getattr(user, 'college', None),
            status='pending',
        )

    def perform_update(self, serializer):
        _ensure_management(self.request.user)
        serializer.save()

    def perform_destroy(self, instance):
        _ensure_management(self.request.user)
        instance.delete()

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        _ensure_management(request.user)

        req = self.get_object()
        if req.status != 'pending':
            raise ValidationError('Only pending requests can be approved.')

        court_id = request.data.get('court_id')
        if not court_id:
            raise ValidationError('court_id is required.')

        court_qs = _scope_queryset(SportCourt.objects.select_related('sport'), request.user)
        court = court_qs.filter(id=court_id).first()
        if not court:
            raise ValidationError('Selected court is not available in your scope.')
        if court.sport_id != req.sport_id:
            raise ValidationError('Selected court does not belong to the requested sport.')

        exact_slot = CourtSlot.objects.filter(
            court=court,
            date=req.requested_date,
            start_time=req.requested_start_time,
            end_time=req.requested_end_time,
        ).first()

        if exact_slot is None:
            overlap_exists = CourtSlot.objects.filter(
                court=court,
                date=req.requested_date,
                start_time__lt=req.requested_end_time,
                end_time__gt=req.requested_start_time,
            ).exists()
            if overlap_exists:
                raise ValidationError('Requested time overlaps with another slot on this court.')

        slot_defaults = {
            'college': req.college or court.college,
            'max_players': max(req.estimated_players or 1, getattr(court.sport, 'min_players', 1)),
            'notes': f"Auto-created from department request #{req.id}",
        }
        if exact_slot is not None:
            slot = exact_slot
            created = False
        else:
            slot = CourtSlot.objects.create(
                court=court,
                date=req.requested_date,
                start_time=req.requested_start_time,
                end_time=req.requested_end_time,
                **slot_defaults,
            )
            created = True
        if not created and slot.max_players < req.estimated_players:
            slot.max_players = req.estimated_players
            slot.save(update_fields=['max_players'])

        req.status = 'approved'
        req.reviewed_by = request.user
        req.allocated_slot = slot
        req.rejection_reason = ''
        req.save(update_fields=['status', 'reviewed_by', 'allocated_slot', 'rejection_reason', 'updated_at'])

        serializer = self.get_serializer(req)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        _ensure_management(request.user)

        req = self.get_object()
        if req.status != 'pending':
            raise ValidationError('Only pending requests can be rejected.')

        req.status = 'rejected'
        req.reviewed_by = request.user
        req.rejection_reason = (request.data.get('reason') or 'Declined by sports desk.').strip()
        req.save(update_fields=['status', 'reviewed_by', 'rejection_reason', 'updated_at'])

        serializer = self.get_serializer(req)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        _ensure_management(request.user)

        req = self.get_object()
        if req.status != 'approved':
            raise ValidationError('Only approved requests can be marked completed.')

        req.status = 'completed'
        req.reviewed_by = request.user
        req.save(update_fields=['status', 'reviewed_by', 'updated_at'])

        serializer = self.get_serializer(req)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='pd-dashboard')
    def pd_dashboard(self, request):
        _ensure_management(request.user)

        today = timezone.localdate()
        month_start = today - timedelta(days=30)

        booking_qs = _scope_queryset(SportSlotBooking.objects.select_related('slot'), request.user)
        slot_qs = _scope_queryset(CourtSlot.objects.select_related('court'), request.user)
        court_qs = _scope_queryset(SportCourt.objects.select_related('sport'), request.user)
        equipment_qs = _scope_queryset(SportEquipment.objects.select_related('sport'), request.user)
        request_qs = _scope_queryset(DepartmentSportsRequest.objects.all(), request.user)

        bookings_today = booking_qs.filter(slot__date=today, status__in=['confirmed', 'attended']).count()
        active_players = booking_qs.filter(slot__date=today, status='attended').count()
        courts_active = court_qs.filter(status='open').count()

        match_ready = (
            slot_qs.filter(date=today)
            .annotate(active_count=Count('bookings', filter=Q(bookings__status__in=['confirmed', 'attended'])))
            .filter(active_count__gte=F('court__sport__min_players'))
            .count()
        )

        pending_requests = request_qs.filter(status='pending').count()
        waitlisted_bookings = booking_qs.filter(slot__date__gte=today, status='waitlisted').count()
        low_stock_items = equipment_qs.filter(status='available').filter(
            issued_quantity__gte=F('total_quantity') - F('low_stock_threshold')
        ).count()
        popular = (
            booking_qs.filter(slot__date__gte=month_start)
            .exclude(status='cancelled')
            .values('slot__court__sport__name')
            .annotate(count=Count('id'))
            .order_by('-count')[:5]
        )

        return Response(
            {
                'bookings_today': bookings_today,
                'active_players': active_players,
                'courts_active': courts_active,
                'match_ready': match_ready,
                'pending_requests': pending_requests,
                'waitlisted_bookings': waitlisted_bookings,
                'low_stock_items': low_stock_items,
                'popular_sports': list(popular),
            }
        )


class SportsFacilitiesCompatibilityViewSet(viewsets.ViewSet):
    """Compatibility endpoint used by existing SportsBooking page.

    Behavior:
    - GET /sports/facilities/               -> list sports
    - GET /sports/facilities/?sport=<id>    -> list courts for sport
    """

    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        sport_id = request.query_params.get('sport')
        status_filter = request.query_params.get('status')

        if sport_id:
            courts = SportCourt.objects.select_related('sport').all()
            courts = _scope_queryset(courts, request.user).filter(sport_id=sport_id)
            if status_filter:
                courts = courts.filter(status=status_filter)
            serializer = SportCourtSerializer(courts, many=True)
            return Response(serializer.data)

        sports = _scope_queryset(Sport.objects.all(), request.user)
        if status_filter:
            sports = sports.filter(status=status_filter)
        serializer = SportSerializer(sports, many=True)
        return Response(serializer.data)
