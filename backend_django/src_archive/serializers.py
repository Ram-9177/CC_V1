from rest_framework import serializers
from .models import Sport, SportCourt, CourtSlot, SportBooking, TournamentMatch
from apps.auth.serializers import UserSerializer

class SportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sport
        fields = '__all__'

class SportCourtSerializer(serializers.ModelSerializer):
    sport_name = serializers.CharField(source='sport.name', read_only=True)
    class Meta:
        model = SportCourt
        fields = '__all__'

class CourtSlotSerializer(serializers.ModelSerializer):
    court_name = serializers.CharField(source='court.name', read_only=True)
    sport_name = serializers.CharField(source='court.sport.name', read_only=True)
    current_bookings = serializers.IntegerField(read_only=True)
    vacancy = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = CourtSlot
        fields = '__all__'

class SportBookingSerializer(serializers.ModelSerializer):
    student_details = UserSerializer(source='student', read_only=True)
    slot_details = CourtSlotSerializer(source='slot', read_only=True)
    
    class Meta:
        model = SportBooking
        fields = '__all__'
        read_only_fields = ['qr_code', 'status', 'check_in_time', 'checked_in_by']

class TournamentMatchSerializer(serializers.ModelSerializer):
    team_a_name = serializers.CharField(source='team_a.name', read_only=True)
    team_b_name = serializers.CharField(source='team_b.name', read_only=True)
    
    class Meta:
        model = TournamentMatch
        fields = '__all__'