"""Events serializers."""

from rest_framework import serializers
from core.constants import AudienceTargets
from .models import Event, EventRegistration, SportsCourt, SportsBookingConfig
from apps.auth.serializers import UserSerializer


class SportsCourtSerializer(serializers.ModelSerializer):
    class Meta:
        model = SportsCourt
        fields = '__all__'


class SportsBookingConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SportsBookingConfig
        fields = '__all__'


class EventSerializer(serializers.ModelSerializer):
    """Serializer for Event model."""
    organizer_details = UserSerializer(source='organizer', read_only=True)
    court_details = SportsCourtSerializer(source='court', read_only=True)
    registration_count = serializers.SerializerMethodField()
    vacancy = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()
    target_audience = serializers.ChoiceField(choices=AudienceTargets.CHOICES, default=AudienceTargets.ALL_STUDENTS)
    
    class Meta:
        model = Event
        fields = [
            'id', 'title', 'event_type', 'description', 'start_date', 'end_date',
            'location', 'organizer', 'organizer_details', 'max_participants',
            'min_players', 'court', 'court_details', 'is_match_ready', 'target_audience',
            'is_mandatory', 'external_link', 'image', 'registration_count',
            'vacancy', 'is_holiday', 'is_exam', 'participants', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'registration_count', 'vacancy', 'participants']
    
    def get_registration_count(self, obj):
        if hasattr(obj, 'reg_count'):
            return obj.reg_count
        return obj.registrations.count()
        
    def get_vacancy(self, obj):
        if not obj.max_participants:
            return None
        reg_count = obj.reg_count if hasattr(obj, 'reg_count') else obj.registrations.count()
        return max(0, obj.max_participants - reg_count)

    def get_participants(self, obj):
        request = self.context.get('request')
        include_participants = bool(request and str(request.query_params.get('include_participants', '0')).lower() in {'1', 'true', 'yes'})
        if not include_participants:
            return []

        return [
            {
                'id': r.student.id,
                'name': r.student.get_full_name(),
                'role': r.student.role,
                'match_group': r.match_group_id
            } for r in obj.registrations.select_related('student').all()
        ]


class EventRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for EventRegistration model."""
    event_details = EventSerializer(source='event', read_only=True)
    student_details = UserSerializer(source='student', read_only=True)
    qr_data = serializers.ReadOnlyField()
    
    class Meta:
        model = EventRegistration
        fields = [
            'id', 'event', 'event_details', 'student', 'student_details',
            'status', 'qr_code_reference', 'qr_data', 'match_group_id', 'check_in_time',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'qr_code_reference', 'match_group_id', 'qr_data']
