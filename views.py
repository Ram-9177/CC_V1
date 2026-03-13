from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Count, Q, F
from django.contrib.auth import get_user_model
from core.permissions import IsAdmin, IsHOD, IsSportsAuthority, IsSecurity
from .models import (
    Sport, SportCourt, CourtSlot, SportBooking, SportsPolicy, 
    Tournament, TournamentMatch
)
from .serializers import (
    SportSerializer, SportCourtSerializer, CourtSlotSerializer, 
    SportBookingSerializer, TournamentMatchSerializer
)
from apps.notifications.utils import notify_user

User = get_user_model()

class SportViewSet(viewsets.ModelViewSet):
    queryset = Sport.objects.all()
    serializer_class = SportSerializer
    permission_classes = [permissions.IsAuthenticated]

class SportCourtViewSet(viewsets.ModelViewSet):
    queryset = SportCourt.objects.all()
    serializer_class = SportCourtSerializer
    permission_classes = [permissions.IsAuthenticated]

class CourtSlotViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Slots are viewed by date to check availability.
    """
    queryset = CourtSlot.objects.select_related('court', 'court__sport')
    serializer_class = CourtSlotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        date_str = self.request.query_params.get('date', str(timezone.now().date()))
        sport_id = self.request.query_params.get('sport_id')

        if sport_id:
            qs = qs.filter(court__sport_id=sport_id)

        # Annotate with vacancy for the specific date
        return qs.annotate(
            current_bookings=Count('bookings', filter=Q(bookings__booking_date=date_str, bookings__status__in=['confirmed', 'match_ready'])),
        ).annotate(
            vacancy=F('court__sport__max_players') - F('current_bookings')
        )

class SportBookingViewSet(viewsets.ModelViewSet):
    queryset = SportBooking.objects.select_related('student', 'slot', 'slot__court').all()
    serializer_class = SportBookingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'super_admin', 'pd', 'pt']:
            return super().get_queryset()
        return super().get_queryset().filter(student=user)

    def create(self, request, *args, **kwargs):
        """Handle booking logic with policies and limits."""
        user = request.user
        slot_id = request.data.get('slot')
        date_str = request.data.get('booking_date')
        
        # 1. Check Policies (Limits)
        policy = SportsPolicy.objects.first() or SportsPolicy.objects.create()
        today_bookings = SportBooking.objects.filter(student=user, booking_date=date_str).count()
        if today_bookings >= policy.max_bookings_per_day:
            return Response({'error': 'Daily booking limit reached'}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Check Availability
        try:
            slot = CourtSlot.objects.select_related('court__sport').get(id=slot_id)
        except CourtSlot.DoesNotExist:
            return Response({'error': 'Invalid Slot'}, status=status.HTTP_404_NOT_FOUND)

        current_count = SportBooking.objects.filter(slot=slot, booking_date=date_str, status__in=['confirmed', 'match_ready']).count()
        if current_count >= slot.court.sport.max_players:
             return Response({'error': 'Slot is full'}, status=status.HTTP_400_BAD_REQUEST)

        # 3. Create Booking
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save(student=user, status='confirmed')

        # 4. Check Match Ready Logic
        new_count = current_count + 1
        if new_count >= slot.court.sport.min_players:
            # Upgrade all bookings in this slot to match_ready
            participants = SportBooking.objects.filter(slot=slot, booking_date=date_str, status='confirmed')
            participants.update(status='match_ready')
            
            # Notify
            for p in participants:
                notify_user(p.student, "🎾 Match Ready!", f"Enough players joined {slot.court.sport.name}. Game on!", "success")

        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], permission_classes=[IsSportsAuthority | IsSecurity])
    def verify_qr(self, request):
        """Security/PT scans QR code."""
        qr_code = request.data.get('qr_code')
        try:
            booking = SportBooking.objects.get(qr_code=qr_code)
        except SportBooking.DoesNotExist:
             return Response({'error': 'Invalid QR'}, status=status.HTTP_404_NOT_FOUND)
        
        if booking.booking_date != timezone.now().date():
             return Response({'error': 'Booking is not for today'}, status=status.HTTP_400_BAD_REQUEST)
        
        if booking.status == 'checked_in':
             return Response({'error': 'Already checked in'}, status=status.HTTP_400_BAD_REQUEST)

        booking.status = 'checked_in'
        booking.check_in_time = timezone.now()
        booking.checked_in_by = request.user
        booking.save()
        
        return Response({'status': 'Verified', 'student': booking.student.get_full_name(), 'court': booking.slot.court.name})

    @action(detail=False, methods=['post'], permission_classes=[IsHOD])
    def bulk_register_department(self, request):
        """HOD registers entire class/department."""
        department = request.data.get('department')
        year = request.data.get('year')
        
        # Placeholder for bulk registration logic
        count = User.objects.filter(department=department, year=year).count()
        return Response({'message': f'Registered {count} students for {department} sports day'})

class AnalyticsViewSet(viewsets.ViewSet):
    permission_classes = [IsSportsAuthority | IsAdmin]

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """PD Dashboard Stats."""
        today = timezone.now().date()
        return Response({
            'bookings_today': SportBooking.objects.filter(booking_date=today).count(),
            'active_players': SportBooking.objects.filter(booking_date=today, status='checked_in').count(),
            'popular_sports': Sport.objects.annotate(count=Count('courts__slots__bookings')).order_by('-count')[:5].values('name', 'count')
        })