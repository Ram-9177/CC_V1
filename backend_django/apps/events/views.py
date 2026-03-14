"""Events views."""

from datetime import timedelta
import csv
import uuid

from django.core.cache import cache
from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.notifications.utils import notify_role, notify_targeted_students
from core.filters import AudienceFilterMixin
from core.permissions import IsTopLevel
from core.role_scopes import get_warden_building_ids, user_is_top_level_management
from websockets.broadcast import broadcast_to_role

from .models import (
    Event,
    EventActivityPoint,
    EventFeedback,
    EventRegistration,
    EventTicket,
    SportsBookingConfig,
    SportsCourt,
)
from .serializers import (
    EventActivityPointSerializer,
    EventFeedbackSerializer,
    EventRegistrationSerializer,
    EventSerializer,
    EventTicketSerializer,
    SportsBookingConfigSerializer,
    SportsCourtSerializer,
)


def _escape_ics(value: str) -> str:
    text = (value or "").replace("\\", "\\\\")
    text = text.replace(";", "\\;").replace(",", "\\,")
    return text.replace("\n", "\\n")


def _event_to_ics(event: Event) -> str:
    now_stamp = timezone.now().strftime("%Y%m%dT%H%M%SZ")
    start_stamp = event.start_date.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    end_stamp = event.end_date.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return "\r\n".join([
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CampusCore//Events//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:event-{event.id}@campuscore.local",
        f"DTSTAMP:{now_stamp}",
        f"DTSTART:{start_stamp}",
        f"DTEND:{end_stamp}",
        f"SUMMARY:{_escape_ics(event.title)}",
        f"DESCRIPTION:{_escape_ics(event.description)}",
        f"LOCATION:{_escape_ics(event.location)}",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ])


def _escape_pdf_text(value: str) -> str:
    return (value or "").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(lines: list[str]) -> bytes:
    text_lines = [_escape_pdf_text(line) for line in lines if line]
    stream_lines = [
        "BT",
        "/F1 16 Tf",
        "50 780 Td",
    ]
    for idx, line in enumerate(text_lines):
        if idx == 0:
            stream_lines.append(f"({line}) Tj")
        else:
            stream_lines.append("0 -22 Td")
            stream_lines.append(f"({line}) Tj")
    stream_lines.append("ET")
    stream = "\n".join(stream_lines).encode("latin-1", errors="replace")

    objects = [
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
        b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
        b"5 0 obj\n<< /Length " + str(len(stream)).encode("ascii") + b" >>\nstream\n" + stream + b"\nendstream\nendobj\n",
    ]

    output = b"%PDF-1.4\n"
    offsets = []
    for obj in objects:
        offsets.append(len(output))
        output += obj

    xref_start = len(output)
    output += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    output += b"0000000000 65535 f \n"
    for off in offsets:
        output += f"{off:010d} 00000 n \n".encode("ascii")
    output += (
        b"trailer\n"
        + f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode("ascii")
        + b"startxref\n"
        + str(xref_start).encode("ascii")
        + b"\n%%EOF"
    )
    return output


class SportsCourtViewSet(viewsets.ModelViewSet):
    queryset = SportsCourt.objects.all()
    serializer_class = SportsCourtSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            from core.permissions import IsTopLevel
            return [IsTopLevel()]
        return super().get_permissions()


class SportsBookingConfigViewSet(viewsets.ModelViewSet):
    queryset = SportsBookingConfig.objects.all()
    serializer_class = SportsBookingConfigSerializer
    permission_classes = [IsAuthenticated]


class EventViewSet(viewsets.ModelViewSet):
    """ViewSet for Event management."""
    
    queryset = Event.objects.select_related('organizer').all()
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Only authorities and chefs can create/update events."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            from core.permissions import IsChef, IsWarden, IsSportsAuthority
            permission_classes = [IsTopLevel | IsChef | IsWarden | IsSportsAuthority]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """Filter events based on user role and date."""
        qs = super().get_queryset()
        
        # Date Filter: default to upcoming or today's events for high performance
        target_date = self.request.query_params.get('date')
        if target_date:
            try:
                date_obj = timezone.datetime.strptime(target_date, '%Y-%m-%d').date()
                qs = qs.filter(start_date__date=date_obj)
            except ValueError:
                pass
        
        return AudienceFilterMixin().filter_audience(self.request, qs)

    def _can_manage_event(self, user, event):
        return user_is_top_level_management(user) or event.organizer_id == user.id

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def sports_dashboard(self, request):
        """Sports Dashboard for PD/PT staff."""
        user = request.user
        from core.permissions import IsSportsAuthority
        if not IsSportsAuthority().has_permission(request, self):
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        today = timezone.now().date()
        todays_events = Event.objects.filter(
            event_type='sports',
            start_date__date=today
        ).annotate(
            reg_count=Count('registrations', filter=Q(registrations__status='registered'))
        ).select_related('court')

        return Response({
            'total_bookings_today': todays_events.count(),
            'slots_with_vacancies': self.get_serializer(
                [e for e in todays_events if e.max_participants and e.reg_count < e.max_participants],
                many=True
            ).data,
            'full_slots': self.get_serializer(
                [e for e in todays_events if e.max_participants and e.reg_count >= e.max_participants],
                many=True
            ).data,
            'attendance_summary': todays_events.aggregate(
                checked_in=Count('registrations', filter=Q(registrations__status='attended'))
            )
        })

    def perform_create(self, serializer):
        user = self.request.user
        target_audience = self.request.data.get('target_audience', 'all_students')
        
        # Enforce Role-Based Audience Restrictions
        if user.role == 'warden' and target_audience != 'hostellers':
             target_audience = 'hostellers' # Force warden to hostellers
        elif user.role in ['pd', 'pt']:
             target_audience = 'all_students' # PD/PT always all_students
             
        event = serializer.save(
            organizer=user,
            target_audience=target_audience
        )
        
        # Trigger Notifications based on target audience
        notif_title = f"🗓️ New Event: {event.title}"
        notif_message = f"An event has been scheduled for {event.start_date.strftime('%B %d, %I:%M %p')}. Click to view details and register."
        notify_targeted_students(target_audience, notif_title, notif_message, 'info', action_url='/events')

        payload = self.get_serializer(event).data
        for role in [
            'student', 'staff', 'admin', 'super_admin', 
            'warden', 'head_warden', 'chef', 'gate_security', 'security_head'
        ]:
            broadcast_to_role(role, 'event_created', payload)

    def perform_update(self, serializer):
        event = serializer.save()
        payload = self.get_serializer(event).data
        for role in [
            'student', 'staff', 'admin', 'super_admin', 
            'warden', 'head_warden', 'chef', 'gate_security', 'security_head'
        ]:
            broadcast_to_role(role, 'event_updated', payload)

    def perform_destroy(self, instance):
        event_id = instance.id
        super().perform_destroy(instance)
        payload = {'id': event_id, 'resource': 'event'}
        for role in [
            'student', 'staff', 'admin', 'super_admin', 
            'warden', 'head_warden', 'chef', 'gate_security', 'security_head'
        ]:
            broadcast_to_role(role, 'event_deleted', payload)
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming events."""
        qs = (
            self.filter_queryset(self.get_queryset())
            .filter(start_date__gte=timezone.now())
            .select_related('organizer', 'court')
            .annotate(reg_count=Count('registrations', filter=Q(registrations__status='registered')))
            .order_by('start_date')
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def sports_upcoming(self, request):
        """Sports/Ground booking feed (separate from generic events feed)."""
        include_participants = str(request.query_params.get('include_participants', '0')).lower() in {'1', 'true', 'yes'}
        cache_key = f"events:sports_upcoming:{request.user.role}:{request.user.id}:{int(include_participants)}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        qs = (
            self.filter_queryset(self.get_queryset())
            .filter(event_type='sports', start_date__gte=timezone.now())
            .select_related('organizer', 'court')
            .annotate(reg_count=Count('registrations', filter=Q(registrations__status='registered')))
            .order_by('start_date')
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            resp = self.get_paginated_response(serializer.data)
            cache.set(cache_key, resp.data, 30)
            return resp
        serializer = self.get_serializer(qs, many=True)
        payload = serializer.data
        cache.set(cache_key, payload, 30)
        return Response(payload)
    
    @action(detail=False, methods=['get'])
    def past(self, request):
        """Get past events."""
        qs = self.filter_queryset(self.get_queryset()).filter(end_date__lt=timezone.now()).order_by('-end_date')
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def share(self, request, pk=None):
        event = self.get_object()
        return Response({
            'id': event.id,
            'title': event.title,
            'description': event.description,
            'location': event.location,
            'start_date': event.start_date,
            'end_date': event.end_date,
            'event_type': event.event_type,
            'link': request.build_absolute_uri(f"/api/events/events/{event.id}/"),
        })

    @action(detail=True, methods=['get'])
    def participants(self, request, pk=None):
        event = self.get_object()
        regs = event.registrations.select_related('student').order_by('created_at')
        return Response([
            {
                'student_id': reg.student_id,
                'name': reg.student.get_full_name() or reg.student.username,
                'registration_number': reg.student.registration_number,
                'status': reg.status,
                'registered_at': reg.created_at,
            }
            for reg in regs
        ])

    @action(detail=True, methods=['get'])
    def participants_csv(self, request, pk=None):
        event = self.get_object()
        if not self._can_manage_event(request.user, event):
            return Response({'error': 'Not authorized to export participants.'}, status=status.HTTP_403_FORBIDDEN)

        response = HttpResponse(content_type='text/csv')
        file_name = slugify(event.title) or f"event-{event.id}"
        response['Content-Disposition'] = f'attachment; filename="{file_name}-participants.csv"'

        writer = csv.writer(response)
        writer.writerow(['registration_id', 'name', 'registration_number', 'status', 'registered_at', 'check_in_time'])
        for reg in event.registrations.select_related('student').order_by('created_at'):
            writer.writerow([
                reg.id,
                reg.student.get_full_name() or reg.student.username,
                reg.student.registration_number,
                reg.status,
                reg.created_at.isoformat(),
                reg.check_in_time.isoformat() if reg.check_in_time else '',
            ])
        return response

    @action(detail=True, methods=['get'])
    def calendar(self, request, pk=None):
        event = self.get_object()
        ics_data = _event_to_ics(event)
        response = HttpResponse(ics_data, content_type='text/calendar; charset=utf-8')
        file_name = slugify(event.title) or f"event-{event.id}"
        response['Content-Disposition'] = f'attachment; filename="{file_name}.ics"'
        return response

    @action(detail=False, methods=['get'])
    def calendar_feed(self, request):
        qs = self.filter_queryset(self.get_queryset()).order_by('start_date')
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        if start:
            qs = qs.filter(start_date__date__gte=start)
        if end:
            qs = qs.filter(start_date__date__lte=end)

        events = qs[:300]
        body = "\r\n".join([
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//CampusCore//Events//EN",
            "CALSCALE:GREGORIAN",
            *[
                "\r\n".join(_event_to_ics(event).split("\r\n")[5:-3])
                for event in events
            ],
            "END:VCALENDAR",
            "",
        ])
        response = HttpResponse(body, content_type='text/calendar; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="campus-events.ics"'
        return response

    @action(detail=True, methods=['post'])
    def send_reminders(self, request, pk=None):
        event = self.get_object()
        if not self._can_manage_event(request.user, event):
            return Response({'error': 'Not authorized to send reminders.'}, status=status.HTTP_403_FORBIDDEN)
        if not event.enable_reminders:
            return Response({'error': 'Reminders disabled for this event.'}, status=status.HTTP_400_BAD_REQUEST)

        from apps.notifications.utils import notify_user

        reminder_at = timezone.now() + timedelta(hours=2)
        recipients = event.registrations.filter(status='registered').select_related('student')
        for reg in recipients:
            notify_user(
                reg.student,
                f"Reminder: {event.title}",
                f"{event.title} is scheduled at {event.start_date.strftime('%I:%M %p')} in {event.location}.",
                'info',
            )

        return Response({
            'event_id': event.id,
            'reminder_window': reminder_at.isoformat(),
            'notified': recipients.count(),
        })

    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        limit = int(request.query_params.get('limit', 20))
        limit = max(1, min(100, limit))

        rows = (
            EventActivityPoint.objects
            .select_related('student')
            .values('student_id', 'student__first_name', 'student__last_name', 'student__username', 'student__registration_number')
            .annotate(total_points=Sum('points'), events_count=Count('event_id', distinct=True))
            .order_by('-total_points', 'student__registration_number')[:limit]
        )
        return Response([
            {
                'student_id': row['student_id'],
                'name': (f"{row['student__first_name']} {row['student__last_name']}".strip() or row['student__username']),
                'registration_number': row['student__registration_number'],
                'total_points': row['total_points'] or 0,
                'events_count': row['events_count'] or 0,
            }
            for row in rows
        ])

    @action(detail=True, methods=['get'])
    def feedback_analytics(self, request, pk=None):
        event = self.get_object()
        qs = event.feedback_entries.all()
        totals = qs.aggregate(avg_rating=Avg('rating'), total=Count('id'))
        breakdown = {
            row['rating']: row['count']
            for row in qs.values('rating').annotate(count=Count('id'))
        }
        return Response({
            'event_id': event.id,
            'event_title': event.title,
            'total_feedback': totals['total'] or 0,
            'average_rating': round(float(totals['avg_rating'] or 0), 2),
            'rating_breakdown': {str(i): breakdown.get(i, 0) for i in range(1, 6)},
        })


class EventRegistrationViewSet(viewsets.ModelViewSet):
    """ViewSet for Event Registrations."""
    
    queryset = EventRegistration.objects.select_related('event', 'student').all()
    serializer_class = EventRegistrationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter based on user role."""
        user = self.request.user
        qs = EventRegistration.objects.select_related('event', 'student').all()
        
        # Admin, Super Admin, Head Warden see all
        if user_is_top_level_management(user):
            return qs
        
        # Organizer see all registrations for their events
        organizer_event_ids = Event.objects.filter(organizer=user).values_list('id', flat=True)
        
        # Warden: See registrations from students in assigned building(s) OR their own events
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            
            if not warden_buildings.exists():
                return qs.filter(event_id__in=organizer_event_ids)
            
            return qs.filter(
                Q(student__room_allocations__room__building_id__in=warden_buildings,
                  student__room_allocations__end_date__isnull=True) |
                Q(event_id__in=organizer_event_ids)
            ).distinct()
        
        # Students see only their own UNLESS they are organizers (though usually they aren't, but for safety)
        if user.role == 'student':
            return qs.filter(Q(student=user) | Q(event_id__in=organizer_event_ids)).distinct()
        
        # Other roles see their organized events
        return qs.filter(event_id__in=organizer_event_ids)

    def _promote_waitlisted(self, event):
        """Move next waitlisted student into registered state when a slot opens."""
        if not event.enable_waitlist:
            return None

        registered_count = event.registrations.filter(status='registered').count()
        if event.max_participants and registered_count >= event.max_participants:
            return None

        next_waitlisted = (
            event.registrations
            .filter(status='waitlisted')
            .select_related('student')
            .order_by('created_at')
            .first()
        )
        if not next_waitlisted:
            return None

        next_waitlisted.status = 'registered'
        if event.enable_attendance and not next_waitlisted.qr_code_reference:
            next_waitlisted.qr_code_reference = str(uuid.uuid4())
        next_waitlisted.save(update_fields=['status', 'qr_code_reference', 'updated_at'])

        from apps.notifications.utils import notify_user

        notify_user(
            next_waitlisted.student,
            f"Seat confirmed: {event.title}",
            "A slot opened up and you have been moved from waitlist to registered.",
            'success',
        )
        return next_waitlisted

    def _award_points_if_eligible(self, registration, reason='participation'):
        event = registration.event
        if not event.enable_points or event.points_value <= 0:
            return None

        point_entry, _ = EventActivityPoint.objects.get_or_create(
            event=event,
            student=registration.student,
            reason=reason,
            defaults={
                'registration': registration,
                'points': event.points_value,
                'awarded_by': self.request.user if getattr(self.request, 'user', None) and self.request.user.is_authenticated else None,
            },
        )
        return point_entry

    def perform_create(self, serializer):
        registration = serializer.save(student=self.request.user)
        if registration.event.enable_attendance and not registration.qr_code_reference:
            registration.qr_code_reference = str(uuid.uuid4())
            registration.save(update_fields=['qr_code_reference', 'updated_at'])
        self._notify_organizer(registration)
        
        # Automatic Notification on booking
        from apps.notifications.utils import notify_user
        event = registration.event
        current_count = event.registrations.filter(status='registered').count()
        notify_user(
            registration.student,
            f"✅ Booking Confirmed: {event.title}",
            f"Joined {event.court.name if event.court else event.location}. Players: {current_count}/{event.max_participants or '∞'}",
            'success'
        )

        payload = self.get_serializer(registration).data
        for role in ['student', 'staff', 'admin', 'super_admin', 'warden', 'head_warden']:
            broadcast_to_role(role, 'event_registration_created', payload)

    def _notify_organizer(self, registration):
        """Notify the event creator about a new registration."""
        event = registration.event
        student = registration.student
        if event.organizer:
            from apps.notifications.utils import notify_user
            notif_title = f"🎟️ New Registration: {event.title}"
            notif_message = (
                f"Student '{student.get_full_name()}' ({student.registration_number}) "
                f"has registered for your event. Email: {student.email or 'N/A'}. "
                f"Registered at: {registration.created_at.strftime('%Y-%m-%d %H:%M:%S')}."
            )
            notify_user(
                event.organizer, 
                notif_title, 
                notif_message, 
                'info', 
                action_url=f"/events?view_registrations={event.id}"
            )

    def perform_update(self, serializer):
        registration = serializer.save()
        payload = self.get_serializer(registration).data
        for role in ['student', 'staff', 'admin', 'super_admin', 'warden', 'head_warden']:
            broadcast_to_role(role, 'event_registration_updated', payload)

    def perform_destroy(self, instance):
        registration_id = instance.id
        super().perform_destroy(instance)
        payload = {'id': registration_id, 'resource': 'event_registration'}
        for role in ['student', 'staff', 'admin', 'super_admin', 'warden', 'head_warden']:
            broadcast_to_role(role, 'event_registration_deleted', payload)
            
    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def verify_qr(self, request):
        """PD/PT verification of booking QR code."""
        qr_ref = request.data.get('qr_code_reference')
        if not qr_ref:
            return Response({'error': 'QR code reference required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            reg = EventRegistration.objects.select_related('event', 'student', 'event__court').get(qr_code_reference=qr_ref)
        except EventRegistration.DoesNotExist:
            return Response({'error': 'Invalid QR Code'}, status=status.HTTP_404_NOT_FOUND)
        
        return Response({
            'registration_id': reg.id,
            'student_name': reg.student.get_full_name(),
            'student_id': reg.student.registration_number,
            'court_name': reg.event.court.name if reg.event.court else reg.event.location,
            'slot_time': f"{reg.event.start_date.strftime('%H:%M')} - {reg.event.end_date.strftime('%H:%M')}",
            'status': reg.status,
            'match_group': reg.match_group_id
        })

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def check_in(self, request, pk=None):
        """Mark student as attended (checked-in)."""
        reg = self.get_object()
        if not reg.event.enable_attendance:
            return Response({'error': 'Attendance disabled for this event.'}, status=status.HTTP_400_BAD_REQUEST)
        reg.status = 'attended'
        reg.check_in_time = timezone.now()
        reg.scan_method = request.data.get('scan_method', 'manual')
        reg.save()
        self._award_points_if_eligible(reg)
        return Response({'status': 'Player Checked-in'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def cancel_entry(self, request, pk=None):
        """Cancel player entry."""
        reg = self.get_object()
        if reg.status == 'cancelled':
            return Response({'error': 'Registration already cancelled'}, status=status.HTTP_400_BAD_REQUEST)
        reg.status = 'cancelled'
        reg.save()
        
        # Recalculate match ready status if player count drops below min
        event = reg.event
        current_players = event.registrations.filter(status='registered').count()
        if event.min_players and current_players < event.min_players:
            if event.is_match_ready:
                event.is_match_ready = False
                event.save()

        promoted = self._promote_waitlisted(event)
                
        payload = {'status': 'Entry Cancelled'}
        if promoted:
            payload['promoted_registration_id'] = promoted.id
            payload['promoted_student_id'] = promoted.student_id
        return Response(payload, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def register(self, request):
        """Register user for an event."""
        event_id = request.data.get('event_id')
        
        if not event_id:
            return Response({'error': 'event_id required'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        try:
            event = Event.objects.get(id=event_id)
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'},
                            status=status.HTTP_404_NOT_FOUND)

        if not event.allow_registration:
            return Response({'error': 'Registration is disabled for this event'}, status=status.HTTP_400_BAD_REQUEST)

        existing = EventRegistration.objects.filter(event=event, student=request.user).first()
        if existing and existing.status in {'registered', 'waitlisted', 'attended'}:
            return Response({'error': f'Already {existing.status} for this event'}, status=status.HTTP_400_BAD_REQUEST)
        
        with transaction.atomic():
            registration_status = 'registered'
            if event.max_participants:
                count = event.registrations.select_for_update().filter(status='registered').count()
                if count >= event.max_participants:
                    if event.enable_waitlist:
                        registration_status = 'waitlisted'
                    else:
                        return Response({'error': 'Event is full'}, status=status.HTTP_400_BAD_REQUEST)

                if registration_status == 'registered' and count + 1 == event.max_participants:
                    notify_role('pd', "🏀 Slot Full", f"The slot '{event.title}' is now at full capacity.", 'info')
        
            # Sports Specific Limits
            if event.event_type == 'sports' and registration_status == 'registered':
                config = SportsBookingConfig.objects.first()
                if config:
                    today = timezone.now().date()
                    start_of_week = today - timezone.timedelta(days=today.weekday())

                    daily_count = EventRegistration.objects.filter(
                        student=request.user,
                        event__event_type='sports',
                        created_at__date=today
                    ).count()

                    weekly_count = EventRegistration.objects.filter(
                        student=request.user,
                        event__event_type='sports',
                        created_at__date__gte=start_of_week
                    ).count()

                    if daily_count >= config.max_bookings_per_day:
                        return Response({'error': f'Daily booking limit of {config.max_bookings_per_day} reached'}, status=status.HTTP_400_BAD_REQUEST)

                    if weekly_count >= config.max_bookings_per_week:
                        return Response({'error': f'Weekly booking limit of {config.max_bookings_per_week} reached'}, status=status.HTTP_400_BAD_REQUEST)
        
            if existing and existing.status == 'cancelled':
                registration = existing
                registration.status = registration_status
            else:
                registration, created = EventRegistration.objects.get_or_create(
                    event=event,
                    student=request.user,
                    defaults={'status': registration_status},
                )
                if not created and registration.status == 'cancelled':
                    registration.status = registration_status
                elif not created:
                    return Response({'error': 'Already registered for this event'}, status=status.HTTP_400_BAD_REQUEST)

            if event.enable_attendance and not registration.qr_code_reference:
                registration.qr_code_reference = str(uuid.uuid4())
            registration.save()
        
        # Sports Specific Logic: Matching
        if event.event_type == 'sports' and registration.status == 'registered':
            
            # Check for Match Ready status
            current_players = event.registrations.filter(status='registered').count()
            if event.min_players and current_players >= event.min_players:
                if not event.is_match_ready:
                    event.is_match_ready = True
                    event.save()
                    
                    # Notify all registered students and assign match groups
                    from apps.notifications.utils import notify_user
                    participants = list(event.registrations.all())
                    for idx, p in enumerate(participants):
                        # Simple alternating group assignment for now
                        group_name = "Team Alpha" if idx % 2 == 0 else "Team Beta"
                        p.match_group_id = group_name
                        p.save()
                        
                        notify_user(
                            p.student,
                            f"⚽ Match Confirmed: {event.title}",
                            f"You are in '{group_name}'. Join the game at {event.location}!",
                            'success'
                        )
            
            registration.save()

        # Notify Organizer
        self._notify_organizer(registration)

        if registration.status == 'waitlisted':
            from apps.notifications.utils import notify_user

            notify_user(
                registration.student,
                f"Waitlist joined: {event.title}",
                "Event is currently full. You are on the waitlist and will be promoted automatically if a slot opens.",
                'info',
            )
        
        serializer = self.get_serializer(registration)
        payload = serializer.data
        for role in ['student', 'staff', 'admin', 'super_admin', 'warden', 'head_warden', 'pd', 'pt']:
            broadcast_to_role(role, 'event_registration_created', payload)
            
        return Response(payload, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def verify_booking(self, request):
        """Verify a booking via QR data."""
        qr_ref = request.data.get('qr_ref')
        if not qr_ref:
            return Response({'error': 'QR Reference required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            registration = EventRegistration.objects.get(qr_code_reference=qr_ref)
        except EventRegistration.DoesNotExist:
            return Response({'error': 'Invalid QR Code or Booking not found'}, status=status.HTTP_404_NOT_FOUND)

        if not registration.event.enable_attendance:
            return Response({'error': 'Attendance disabled for this event.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if registration.status == 'attended':
            return Response({'error': 'Student already checked in'}, status=status.HTTP_400_BAD_REQUEST)
        
        registration.status = 'attended'
        registration.check_in_time = timezone.now()
        registration.scan_method = request.data.get('scan_method', 'qr')
        registration.save()
        self._award_points_if_eligible(registration)
        
        # Notify student
        from apps.notifications.utils import notify_user
        notify_user(
            registration.student,
            "✅ Sports Check-in Success",
            f"You have been checked in for '{registration.event.title}' at {registration.check_in_time.strftime('%I:%M %p')}.",
            'success'
        )
        
        serializer = self.get_serializer(registration)
        payload = serializer.data
        for role in ['student', 'staff', 'admin', 'super_admin', 'warden', 'head_warden', 'pd', 'pt']:
            broadcast_to_role(role, 'event_registration_updated', payload)
            
        return Response(payload)

    @action(detail=True, methods=['post'])
    def mark_attended(self, request, pk=None):
        """Mark user as attended."""
        registration = self.get_object()
        if not registration.event.enable_attendance:
            return Response({'error': 'Attendance disabled for this event.'}, status=status.HTTP_400_BAD_REQUEST)
        registration.status = 'attended'
        registration.save()
        self._award_points_if_eligible(registration)
        
        serializer = self.get_serializer(registration)
        payload = serializer.data
        for role in ['student', 'staff', 'admin', 'super_admin', 'warden', 'head_warden', 'pd', 'pt']:
            broadcast_to_role(role, 'event_registration_updated', payload)
            
        return Response(payload)

    @action(detail=True, methods=['get'])
    def certificate(self, request, pk=None):
        registration = self.get_object()
        event = registration.event

        if not event.enable_certificates:
            return Response({'error': 'Certificates are disabled for this event.'}, status=status.HTTP_400_BAD_REQUEST)

        if registration.status != 'attended':
            return Response({'error': 'Certificate is available only after attendance is marked.'}, status=status.HTTP_400_BAD_REQUEST)

        student_name = registration.student.get_full_name() or registration.student.username
        lines = [
            "Participation Certificate",
            "",
            f"This certifies that {student_name}",
            f"participated in {event.title}",
            f"held at {event.location} on {event.start_date.strftime('%d %b %Y, %I:%M %p')}",
            "",
            "CampusCore Event System",
        ]
        pdf_bytes = _build_simple_pdf(lines)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        file_name = slugify(f"certificate-{event.title}-{registration.student.registration_number}")
        response['Content-Disposition'] = f'attachment; filename="{file_name}.pdf"'
        return response


class EventActivityPointViewSet(viewsets.ReadOnlyModelViewSet):
    """View student points ledger and leaderboard-ready point records."""

    queryset = EventActivityPoint.objects.select_related('event', 'student', 'awarded_by').all()
    serializer_class = EventActivityPointSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user_is_top_level_management(user):
            return qs
        if user.role == 'student':
            return qs.filter(student=user)
        return qs.filter(Q(student=user) | Q(event__organizer=user)).distinct()

    @action(detail=False, methods=['get'])
    def mine(self, request):
        qs = self.get_queryset().filter(student=request.user)
        total = qs.aggregate(total=Sum('points'))['total'] or 0
        return Response({
            'student_id': request.user.id,
            'total_points': total,
            'entries': self.get_serializer(qs[:100], many=True).data,
        })


class EventFeedbackViewSet(viewsets.ModelViewSet):
    """Submit and inspect event feedback."""

    queryset = EventFeedback.objects.select_related('event', 'student', 'registration').all()
    serializer_class = EventFeedbackSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user_is_top_level_management(user):
            return qs
        if user.role == 'student':
            return qs.filter(student=user)
        return qs.filter(event__organizer=user)

    def perform_create(self, serializer):
        event = serializer.validated_data['event']
        registration = EventRegistration.objects.filter(event=event, student=self.request.user).first()
        if not registration:
            raise ValidationError('You must register for the event before submitting feedback.')
        serializer.save(student=self.request.user, registration=registration)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        event_id = request.query_params.get('event_id')
        qs = self.get_queryset()
        if event_id:
            qs = qs.filter(event_id=event_id)

        totals = qs.aggregate(total=Count('id'), average=Avg('rating'))
        grouped = qs.values('rating').annotate(count=Count('id')).order_by('rating')
        return Response({
            'total_feedback': totals['total'] or 0,
            'average_rating': round(float(totals['average'] or 0), 2),
            'rating_breakdown': {str(item['rating']): item['count'] for item in grouped},
        })


class EventTicketViewSet(viewsets.ModelViewSet):
    """Ticketing API with payment status and QR validation."""

    queryset = EventTicket.objects.select_related('event', 'student', 'registration').all()
    serializer_class = EventTicketSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user_is_top_level_management(user):
            return qs
        if user.role == 'student':
            return qs.filter(student=user)
        return qs.filter(event__organizer=user)

    def create(self, request, *args, **kwargs):
        event_id = request.data.get('event')
        if not event_id:
            return Response({'error': 'event is required'}, status=status.HTTP_400_BAD_REQUEST)

        event = Event.objects.filter(id=event_id).first()
        if not event:
            return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
        if not event.enable_tickets:
            return Response({'error': 'Ticketing is disabled for this event'}, status=status.HTTP_400_BAD_REQUEST)

        registration = EventRegistration.objects.filter(event=event, student=request.user).first()
        if not registration:
            return Response({'error': 'Register for the event before requesting a ticket'}, status=status.HTTP_400_BAD_REQUEST)

        ticket = EventTicket.objects.create(
            event=event,
            student=request.user,
            registration=registration,
            amount=event.ticket_price,
            currency=request.data.get('currency', 'INR'),
            payment_status='pending' if event.ticket_price > 0 else 'paid',
            paid_at=timezone.now() if event.ticket_price <= 0 else None,
        )
        serializer = self.get_serializer(ticket)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def update_payment(self, request, pk=None):
        ticket = self.get_object()
        if not (user_is_top_level_management(request.user) or ticket.event.organizer_id == request.user.id):
            return Response({'error': 'Not authorized to update payment status'}, status=status.HTTP_403_FORBIDDEN)

        new_status = request.data.get('payment_status')
        allowed = {'pending', 'paid', 'failed', 'refunded'}
        if new_status not in allowed:
            return Response({'error': 'Invalid payment_status'}, status=status.HTTP_400_BAD_REQUEST)

        ticket.payment_status = new_status
        ticket.payment_reference = request.data.get('payment_reference', ticket.payment_reference)
        if new_status == 'paid' and ticket.paid_at is None:
            ticket.paid_at = timezone.now()
        ticket.save()
        return Response(self.get_serializer(ticket).data)

    @action(detail=False, methods=['post'])
    def validate_qr(self, request):
        token = request.data.get('qr_token')
        if not token:
            return Response({'error': 'qr_token is required'}, status=status.HTTP_400_BAD_REQUEST)

        ticket = EventTicket.objects.filter(qr_token=token).select_related('event', 'student').first()
        if not ticket:
            return Response({'valid': False, 'error': 'Ticket not found'}, status=status.HTTP_404_NOT_FOUND)

        if ticket.payment_status != 'paid':
            return Response({'valid': False, 'error': 'Ticket payment is incomplete'}, status=status.HTTP_400_BAD_REQUEST)

        if ticket.ticket_status != 'active':
            return Response({'valid': False, 'error': f'Ticket is {ticket.ticket_status}'}, status=status.HTTP_400_BAD_REQUEST)

        consume = str(request.data.get('consume', '0')).lower() in {'1', 'true', 'yes'}
        if consume:
            ticket.ticket_status = 'used'
            ticket.used_at = timezone.now()
            ticket.save(update_fields=['ticket_status', 'used_at', 'updated_at'])

        return Response({
            'valid': True,
            'ticket_id': ticket.id,
            'event_id': ticket.event_id,
            'student_id': ticket.student_id,
            'ticket_status': ticket.ticket_status,
            'payment_status': ticket.payment_status,
        })
