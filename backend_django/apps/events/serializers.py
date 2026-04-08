"""Events app serializers — Phase 6."""
from rest_framework import serializers
from .models import Event, EventRegistration
from apps.auth.serializers import UserSerializer
from apps.sports.models import SportFacility


EVENT_TYPE_INPUT_MAP = {
    'sports': 'sports',
    'cultural': 'cultural',
    'educational': 'academic',
    'academic': 'academic',
    # FE currently exposes these as event types; map safely to supported storage values.
    'social': 'cultural',
    'maintenance': 'academic',
}

EVENT_TYPE_OUTPUT_MAP = {
    'academic': 'educational',
}

class EventSerializer(serializers.ModelSerializer):
    """Event model serializer."""
    created_by_details = UserSerializer(source='created_by', read_only=True)
    registration_count = serializers.SerializerMethodField()
    vacancy = serializers.SerializerMethodField()
    is_match_ready = serializers.SerializerMethodField()

    # FE compatibility aliases
    start_date = serializers.DateTimeField(source='start_time', required=False)
    end_date = serializers.DateTimeField(source='end_time', required=False)
    max_participants = serializers.IntegerField(source='capacity', required=False, allow_null=True)
    court = serializers.PrimaryKeyRelatedField(
        source='facility', queryset=SportFacility.objects.all(), required=False, allow_null=True
    )
    court_details = serializers.SerializerMethodField()
    organizer = serializers.IntegerField(source='created_by_id', read_only=True)
    organizer_details = serializers.SerializerMethodField()

    # FE sends these today; persisted support can be introduced later.
    min_players = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    is_mandatory = serializers.BooleanField(required=False, default=False, write_only=True)
    external_link = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    target_audience = serializers.CharField(required=False, allow_blank=True, allow_null=True, write_only=True)
    image = serializers.ImageField(required=False, allow_null=True, write_only=True)

    # Allow FE event type values and map to model-backed values.
    event_type = serializers.CharField()
    
    class Meta:
        model = Event
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_registration_count(self, obj):
        return obj.registrations_v2.filter(status='registered').count()

    def get_vacancy(self, obj):
        if obj.capacity is None:
            return None
        return max(obj.capacity - self.get_registration_count(obj), 0)

    def get_is_match_ready(self, obj):
        if obj.event_type != 'sports' or obj.capacity is None:
            return False
        # Conservative readiness signal until explicit min_players is persisted.
        return self.get_registration_count(obj) >= 2

    def get_court_details(self, obj):
        facility = getattr(obj, 'facility', None)
        if not facility:
            return None
        return {
            'id': facility.id,
            'name': facility.name,
            'sport_name': facility.name,
            'location_details': facility.description,
        }

    def get_organizer_details(self, obj):
        user = getattr(obj, 'created_by', None)
        if not user:
            return None
        full_name = user.get_full_name().strip() if hasattr(user, 'get_full_name') else ''
        return {
            'id': user.id,
            'name': full_name or user.username,
            'role': getattr(user, 'role', ''),
            'email': user.email,
        }

    def validate_event_type(self, value):
        normalized = (value or '').strip().lower()
        mapped = EVENT_TYPE_INPUT_MAP.get(normalized)
        if not mapped:
            raise serializers.ValidationError('Invalid event type.')
        return mapped

    def create(self, validated_data):
        # Drop FE-only transient fields that are not yet persisted in Event model.
        validated_data.pop('min_players', None)
        validated_data.pop('is_mandatory', None)
        validated_data.pop('target_audience', None)
        validated_data.pop('image', None)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data.pop('min_players', None)
        validated_data.pop('is_mandatory', None)
        validated_data.pop('target_audience', None)
        validated_data.pop('image', None)
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['event_type'] = EVENT_TYPE_OUTPUT_MAP.get(data.get('event_type'), data.get('event_type'))
        # FE keys expected on cards/forms; default safely until persisted columns are introduced.
        data.setdefault('is_mandatory', False)
        data.setdefault('target_audience', 'all_students')
        data.setdefault('image', None)
        data.setdefault('min_players', None)
        return data

class EventRegistrationSerializer(serializers.ModelSerializer):
    """Event Registration serializer."""
    event_details = EventSerializer(source='event', read_only=True)
    student_details = UserSerializer(source='student', read_only=True)
    
    class Meta:
        model = EventRegistration
        fields = '__all__'
        read_only_fields = ['student', 'created_at', 'updated_at']
