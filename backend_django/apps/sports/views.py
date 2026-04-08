"""Sports app views — Phase 6."""

from rest_framework import viewsets, permissions, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
from django.db.models import Count, Q, Avg, F
from django.db import transaction

from core.college_mixin import CollegeScopeMixin
from core.event_service import EventService
from core.events import AppEvents
from .models import SportFacility, SportBooking, SportsMatch
from .serializers import SportFacilitySerializer, SportBookingSerializer, SportsMatchSerializer

class SportFacilityViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Resource: Grounds / Courts / Gym facilities management."""
    
    queryset = SportFacility.objects.filter(is_active=True)
    serializer_class = SportFacilitySerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def availability(self, request):
        """Facility search for open slots."""
        facility_id = request.query_params.get('facility_id')
        requested_date = request.query_params.get('date') # YYYY-MM-DD
        
        if not facility_id or not requested_date:
            raise ValidationError("Please provide facility_id and date.")
            
        # Get all bookings for that facility on that day
        bookings = SportBooking.objects.filter(
            facility_id=facility_id,
            start_time__date=requested_date,
            status__in=['approved', 'pending']
        ).values('start_time', 'end_time')
        
        return Response({
            "facility_id": facility_id,
            "date": requested_date,
            "booked_slots": list(bookings)
        })

class SportBookingViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Scheduling: Facility booking or slot assignment."""
    
    queryset = SportBooking.objects.all()
    serializer_class = SportBookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        if user.role in ['admin', 'super_admin', 'pd', 'pt', 'staff', 'faculty']:
            return qs
        return qs.filter(booked_by=user)


    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        """Approve a student's booking request."""
        if request.user.role not in ['pd', 'pt', 'admin', 'super_admin']:
            raise PermissionDenied("Only sports personnel can approve bookings.")
            
        booking = self.get_object()
        
        # Re-check overlap on approval just in case
        overlap = SportBooking.objects.filter(
            facility=booking.facility,
            status='approved'
        ).filter(
            Q(start_time__lt=booking.end_time, end_time__gt=booking.start_time)
        ).exclude(id=booking.id).exists()
        
        if overlap:
            booking.status = 'rejected'
            booking.save()
            return Response({"detail": "Rejected automatically due to overlap."}, status=http_status.HTTP_409_CONFLICT)
            
        booking.status = 'approved'
        booking.save()
        return Response({"detail": "Booking approved."})

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        """Reject a booking request."""
        if request.user.role not in ['pd', 'pt', 'admin', 'super_admin']:
            raise PermissionDenied("Only sports personnel can reject bookings.")
            
        booking = self.get_object()
        booking.status = 'rejected'
        booking.save()
        return Response({"detail": "Booking rejected."})

    def perform_create(self, serializer):
        """Booking with overlap check validation."""
        facility = serializer.validated_data['facility']
        start_time = serializer.validated_data['start_time']
        end_time = serializer.validated_data['end_time']
        
        # 1. Overlap Check
        overlapping_booking = SportBooking.objects.filter(
            facility=facility,
            status__in=['approved', 'pending']
        ).filter(
            Q(start_time__lt=end_time, end_time__gt=start_time)
        ).exists()
        
        if overlapping_booking:
            raise ValidationError("Schedule conflict: Overlapping booking already exists.")
            
        booking = serializer.save(
            booked_by=self.request.user
        )
        
        # Emit Booking Event
        EventService.emit(
            AppEvents.BOOKING_CREATED,
            self.request.user,
            {"booking_id": booking.id, "facility_id": facility.id}
        )

class SportsMatchViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Lifecycle record: Team contests."""
    
    queryset = SportsMatch.objects.all()
    serializer_class = SportsMatchSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        """Create match with college and author context."""
        match = serializer.save(
            organizer=self.request.user
        )
        
    @action(detail=True, methods=['post'])
    def start_match(self, request, pk=None):
        """Start match lifecycle."""
        match = self.get_object()
        match.status = 'ongoing'
        match.save()
        
        EventService.emit(
            AppEvents.MATCH_STARTED,
            request.user,
            {"match_id": match.id}
        )
        return Response({"status": f"Match '{match.title}' is now ongoing."})

    @action(detail=True, methods=['post'])
    def update_score(self, request, pk=None):
        """Real-time score update support."""
        match = self.get_object()
        score = request.data.get('score')
        if not score:
             raise ValidationError("Please provide new score data.")
             
        match.score = score
        match.save()
        return Response({"status": "Score updated.", "current_score": match.score})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Close match lifecycle with winner result."""
        match = self.get_object()
        winner = request.data.get('winner')
        
        match.status = 'completed'
        match.winner = winner if winner else match.winner
        match.save()
        
        EventService.emit(
            AppEvents.MATCH_COMPLETED,
            request.user,
            {"match_id": match.id, "winner": match.winner}
        )
        return Response({"status": "Match completed.", "winner": match.winner})

    @action(detail=False, methods=['get'])
    def sports_analytics(self, request):
        """Operational analytics for facility usage."""
        if not request.user.role in ['admin', 'super_admin', 'pd']:
            raise PermissionDenied("Only management can view sports analytics.")

        # Facility Usage
        stats = SportBooking.objects.aggregate(
            total_bookings=Count('id'),
            total_active=Count('id', filter=Q(status='approved')),
            cancelled_count=Count('id', filter=Q(status='cancelled'))
        )
        
        # Peak hours simulation or real group by
        # Real group by hour
        from django.db.models.functions import ExtractHour
        peak_hours = SportBooking.objects.annotate(hour=ExtractHour('start_time')).values('hour').annotate(count=Count('id')).order_by('-count')[:5]
        
        analytics_payload = {
            "summary": {
                "total_bookings": stats['total_bookings'],
                "active_rate": f"{(stats['total_active'] / (stats['total_bookings'] or 1)) * 100:.1f}%",
                "cancelled_rate": f"{(stats['cancelled_count'] / (stats['total_bookings'] or 1)) * 100:.1f}%"
            },
            "facility_usage": SportBooking.objects.values('facility__name').annotate(
                usage_count=Count('id')
            ).order_by('-usage_count'),
            "peak_hours_distribution": list(peak_hours)
        }
        
        return Response(analytics_payload)
