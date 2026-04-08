"""Events app views — Phase 6."""

from rest_framework import viewsets, permissions, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
from django.db.models import Count, Q, Avg
from django.db import transaction

from core.college_mixin import CollegeScopeMixin
from core.event_service import EventService
from core.events import AppEvents
from core.permissions import IsStaff, user_is_top_level_management
from apps.sports.models import SportFacility
from .models import Event, EventRegistration
from .serializers import EventSerializer, EventRegistrationSerializer

class EventViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Event resource + participation management."""
    
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        """Allow staff to manage events, all to view."""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'mark_completed']:
            return [permissions.IsAuthenticated(), IsStaff()]
        return super().get_permissions()

    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Frontend compatibility endpoint: list upcoming events."""
        qs = self.filter_queryset(self.get_queryset().filter(start_time__gte=timezone.now()).order_by('start_time'))
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def past(self, request):
        """Frontend compatibility endpoint: list past events."""
        qs = self.filter_queryset(self.get_queryset().filter(end_time__lt=timezone.now()).order_by('-start_time'))
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='sports-courts')
    def sports_courts(self, request):
        """Frontend compatibility endpoint for event sports-court selector."""
        user = request.user
        qs = SportFacility.objects.filter(is_active=True).order_by('name')
        if not user_is_top_level_management(user) and getattr(user, 'college_id', None):
            qs = qs.filter(college_id=user.college_id)
        payload = [
            {
                'id': facility.id,
                'name': facility.name,
                'sport_name': facility.name,
                'location_details': facility.description,
            }
            for facility in qs
        ]
        return Response(payload)

    def perform_create(self, serializer):
        """Initialize event with college and author context."""
        college = self.request.user.college
        if not college:
             raise ValidationError("User must be associated with a college to create events.")
             
        event = serializer.save(
            college=college,
            created_by=self.request.user
        )
        
        # System Notification
        EventService.emit(
            AppEvents.EVENT_CREATED,
            self.request.user,
            {"event_id": event.id, "title": event.title}
        )

    @action(detail=True, methods=['post'])
    def register(self, request, pk=None):
        """Student registration with capacity and business rule validation."""
        event = self.get_object()
        user = request.user
        
        # 1. Capacity Check
        if event.capacity:
            reg_count = event.registrations_v2.filter(status='registered').count()
            if reg_count >= event.capacity:
                raise ValidationError("Event capacity reached. Participation rejected.")

        # 2. Duplicate Registration Check
        if event.registrations_v2.filter(student=user, status='registered').exists():
            raise ValidationError("Student already registered for this event.")

        # 3. Payment Block Check (Simulated)
        # In a real system, we'd check if a payment record exists.
        # Here we just check if it's a paid event and block if not 'paid' status.
        # For new registration, we set to 'pending' if it's paid.
        payment_status = 'waived' if not event.is_paid else 'pending'
        
        with transaction.atomic():
            registration = EventRegistration.objects.create(
                event=event,
                student=user,
                college=event.college,
                status='registered',
                payment_status=payment_status
            )
            
            # Emit Registration Event
            EventService.emit(
                AppEvents.EVENT_REGISTERED,
                user,
                {"event_id": event.id, "registration_id": registration.id}
            )

        return Response(EventRegistrationSerializer(registration).data, status=http_status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Operational analytics for event participation."""
        if not request.user.role in ['admin', 'super_admin', 'pd']:
            raise PermissionDenied("Only management can view event analytics.")

        # Overall Metrics
        stats = Event.objects.aggregate(
            total_events=Count('id'),
            total_registrations=Count('registrations_v2'),
            attended_count=Count('registrations_v2', filter=Q(registrations_v2__status='attended')),
            cancelled_count=Count('registrations_v2', filter=Q(registrations_v2__status='cancelled'))
        )
        
        # Rates
        reg_count = stats['total_registrations'] or 1
        attended = stats['attended_count'] or 0
        
        analytics_payload = {
            "summary": {
                "total_events": stats['total_events'],
                "total_registrations": reg_count,
                "attendance_rate": f"{(attended / reg_count) * 100:.1f}%",
                "no_show_rate": f"{((reg_count - attended) / reg_count) * 100:.1f}%"
            },
            "by_type": Event.objects.values('event_type').annotate(
                count=Count('id'),
                avg_reg=Count('registrations_v2') # Not exactly average, but total for type
            ).order_by('-count')
        }
        
        return Response(analytics_payload)

    @action(detail=True, methods=['post'])
    def mark_completed(self, request, pk=None):
        """Close event lifecycle."""
        event = self.get_object()
        event.status = 'completed'
        event.save()
        
        EventService.emit(
            AppEvents.EVENT_COMPLETED,
            request.user,
            {"event_id": event.id}
        )
        return Response({"status": "Event completed and closed."})


class EventRegistrationViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Registration tracking and attendance marking."""
    
    queryset = EventRegistration.objects.all()
    serializer_class = EventRegistrationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        event_id = self.request.query_params.get('event_id')
        if event_id:
            qs = qs.filter(event_id=event_id)
        # Management/staff see everything
        if user.role in ['admin', 'super_admin', 'pd', 'pt', 'staff', 'faculty']:
            return qs.order_by('-created_at')
        # Students see only their own registrations
        return qs.filter(student=user).order_by('-created_at')

    @action(detail=False, methods=['post'], url_path='register')
    def register(self, request):
        """Frontend compatibility endpoint: register with event_id payload."""
        event_id = request.data.get('event_id')
        if not event_id:
            raise ValidationError("event_id is required.")

        user = request.user
        event_qs = Event.objects.all()
        # Enforce tenant scope: non-top-level users can only register within their college.
        if not user_is_top_level_management(user):
            college_id = getattr(user, 'college_id', None)
            if not college_id:
                raise ValidationError("User must belong to a college to register for events.")
            event_qs = event_qs.filter(college_id=college_id)

        event = event_qs.filter(id=event_id).first()
        if not event:
            raise ValidationError("Event not found.")

        if event.capacity:
            reg_count = event.registrations_v2.filter(status='registered').count()
            if reg_count >= event.capacity:
                raise ValidationError("Event capacity reached. Participation rejected.")

        if event.registrations_v2.filter(student=user, status='registered').exists():
            raise ValidationError("Student already registered for this event.")

        payment_status = 'waived' if not event.is_paid else 'pending'

        with transaction.atomic():
            registration = EventRegistration.objects.create(
                event=event,
                student=user,
                college=event.college,
                status='registered',
                payment_status=payment_status,
            )

            EventService.emit(
                AppEvents.EVENT_REGISTERED,
                user,
                {"event_id": event.id, "registration_id": registration.id},
            )

        return Response(EventRegistrationSerializer(registration).data, status=http_status.HTTP_201_CREATED)


    @action(detail=True, methods=['post'])
    def mark_attendance(self, request, pk=None):
        """Attendance tracking by staff."""
        registration = self.get_object()
        
        # Permission check: PD or Staff only
        if not request.user.role in ['admin', 'pd', 'super_admin', 'staff']:
            raise PermissionDenied("Unauthorized to mark event attendance.")
            
        registration.status = 'attended'
        registration.attended_at = timezone.now()
        registration.save()
        
        return Response({"status": f"Attendance marked for {registration.student.get_full_name()}"})

    @action(detail=True, methods=['post'], url_path='mark_attended')
    def mark_attended(self, request, pk=None):
        """Frontend compatibility alias for mark_attendance."""
        return self.mark_attendance(request, pk=pk)
