"""Sports app serializers."""
from rest_framework import serializers
from apps.sports.models import SportFacility, SportBooking, SportsMatch
from apps.auth.serializers import UserSerializer

class SportFacilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = SportFacility
        fields = ['id', 'name', 'description', 'is_active', 'location']

class SportBookingSerializer(serializers.ModelSerializer):
    student_details = UserSerializer(source='student', read_only=True)
    facility_details = SportFacilitySerializer(source='facility', read_only=True)
    
    class Meta:
        model = SportBooking
        fields = [
            'id', 'facility', 'facility_details', 'student', 'student_details',
            'booking_date', 'start_time', 'end_time', 'status', 'purpose', 'created_at'
        ]
        read_only_fields = ['student', 'status', 'created_at']

class SportsMatchSerializer(serializers.ModelSerializer):
    organizer_details = UserSerializer(source='organizer', read_only=True)
    facility_details = SportFacilitySerializer(source='facility', read_only=True)
    
    class Meta:
        model = SportsMatch
        fields = [
            'id', 'facility', 'facility_details', 'title', 'match_date',
            'organizer', 'organizer_details', 'team_a_name', 'team_b_name',
            'score_a', 'score_b', 'is_completed', 'summary'
        ]
        read_only_fields = ['organizer', 'is_completed']
