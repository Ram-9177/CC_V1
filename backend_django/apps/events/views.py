"""Events views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsTopLevel
from core.role_scopes import get_warden_building_ids, user_is_top_level_management
from .models import Event, EventRegistration
from .serializers import EventSerializer, EventRegistrationSerializer
from django.utils import timezone
from apps.notifications.utils import notify_role
from websockets.broadcast import broadcast_to_role


class EventViewSet(viewsets.ModelViewSet):
    """ViewSet for Event management."""
    
    queryset = Event.objects.select_related('organizer').all()
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Only admins can create/update events."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsTopLevel]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def perform_create(self, serializer):
        event = serializer.save(organizer=self.request.user)
        
        # Trigger Notifications for Students
        notif_title = f"🗓️ New Event: {event.title}"
        notif_message = f"An event has been scheduled for {event.start_date.strftime('%B %d, %I:%M %p')}. Click to view details and register."
        notify_role('student', notif_title, notif_message, 'info', action_url='/events')

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
        qs = self.filter_queryset(self.get_queryset()).filter(start_date__gte=timezone.now()).order_by('start_date')
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
    
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
        
        # Warden: See registrations from students in assigned building(s)
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            
            if not warden_buildings.exists():
                return qs  # Fail-safe: unassigned wardens see all
            
            return qs.filter(
                student__room_allocations__room__building_id__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).distinct()
        
        # Students see only their own
        if user.role == 'student':
            return qs.filter(student=user)
        
        return qs.none()
    def perform_create(self, serializer):
        registration = serializer.save(student=self.request.user)
        payload = self.get_serializer(registration).data
        for role in ['student', 'staff', 'admin', 'super_admin', 'warden', 'head_warden']:
            broadcast_to_role(role, 'event_registration_created', payload)

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
        
        # Check capacity
        if event.max_participants:
            if event.registrations.filter(status='registered').count() >= event.max_participants:
                return Response({'error': 'Event is full'},
                                status=status.HTTP_400_BAD_REQUEST)
        
        registration, created = EventRegistration.objects.get_or_create(
            event=event,
            student=request.user
        )
        
        if not created:
            return Response({'error': 'Already registered for this event'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        serializer = self.get_serializer(registration)
        payload = serializer.data
        for role in ['student', 'staff', 'admin', 'super_admin', 'warden', 'head_warden']:
            broadcast_to_role(role, 'event_registration_created', payload)
            
        return Response(payload, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def mark_attended(self, request, pk=None):
        """Mark user as attended."""
        registration = self.get_object()
        registration.status = 'attended'
        registration.save()
        
        serializer = self.get_serializer(registration)
        payload = serializer.data
        for role in ['student', 'staff', 'admin', 'super_admin', 'warden', 'head_warden']:
            broadcast_to_role(role, 'event_registration_updated', payload)
            
        return Response(payload)
