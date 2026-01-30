"""Events views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, user_is_admin
from .models import Event, EventRegistration
from .serializers import EventSerializer, EventRegistrationSerializer
from django.utils import timezone


class EventViewSet(viewsets.ModelViewSet):
    """ViewSet for Event management."""
    
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Only admins can create/update events."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['get'])
    def upcoming(self, request):
        """Get upcoming events."""
        events = Event.objects.filter(start_date__gte=timezone.now()).order_by('start_date')
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def past(self, request):
        """Get past events."""
        events = Event.objects.filter(end_date__lt=timezone.now()).order_by('-end_date')
        serializer = self.get_serializer(events, many=True)
        return Response(serializer.data)


class EventRegistrationViewSet(viewsets.ModelViewSet):
    """ViewSet for Event Registrations."""
    
    queryset = EventRegistration.objects.all()
    serializer_class = EventRegistrationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter based on user role."""
        user = self.request.user
        if user_is_admin(user):
            return EventRegistration.objects.all()
        return EventRegistration.objects.filter(student=user)
    
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
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['post'])
    def mark_attended(self, request, pk=None):
        """Mark user as attended."""
        registration = self.get_object()
        registration.status = 'attended'
        registration.save()
        
        serializer = self.get_serializer(registration)
        return Response(serializer.data)
