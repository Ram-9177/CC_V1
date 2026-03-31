"""Sports app views."""
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.sports.models import SportFacility, SportBooking, SportsMatch
from apps.sports.serializers import (
    SportFacilitySerializer, SportBookingSerializer, SportsMatchSerializer
)
from apps.notifications.service import NotificationService
from django.db import transaction

class SportFacilityViewSet(viewsets.ReadOnlyModelViewSet):
    """View available sports facilities."""
    queryset = SportFacility.objects.filter(is_active=True)
    serializer_class = SportFacilitySerializer
    permission_classes = [permissions.IsAuthenticated]

class SportBookingViewSet(viewsets.ModelViewSet):
    """Manage sports field bookings."""
    queryset = SportBooking.objects.select_related('slot', 'student').all() # Note: I use 'slot' here as per legacy
    serializer_class = SportBookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'super_admin', 'pd']:
            return self.queryset
        return self.queryset.filter(student=user)

    def perform_create(self, serializer):
        # Prevent double booking in service layer or here
        serializer.save(student=self.request.user)
        # Notify PD
        NotificationService.send_to_role('pd', 'New Ground Booking', f"{self.request.user.username} requested a slot.", 'info', '/sports')

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        """Approve a booking (PD only)."""
        if request.user.role not in ['admin', 'super_admin', 'pd']:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
            
        booking = self.get_object()
        booking.status = 'approved'
        booking.save()
        
        NotificationService.send(booking.student, 'Booking Approved ✅', f'Your booking for {booking.facility.name} on {booking.booking_date} is approved.', 'success')
        return Response(self.get_serializer(booking).data)

class SportsMatchViewSet(viewsets.ModelViewSet):
    """Manage sports matches."""
    queryset = SportsMatch.objects.select_related('facility', 'organizer').all()
    serializer_class = SportsMatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(organizer=self.request.user)
