"""Events serializers."""

from rest_framework import serializers
from .models import Event, EventRegistration
from apps.auth.serializers import UserSerializer


class EventSerializer(serializers.ModelSerializer):
    """Serializer for Event model."""
    organizer_details = UserSerializer(source='organizer', read_only=True)
    registration_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Event
        fields = ['id', 'title', 'event_type', 'description', 'start_date', 'end_date',
                  'location', 'organizer', 'organizer_details', 'max_participants',
                  'is_mandatory', 'external_link', 'image', 'registration_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'registration_count']
    
    def get_registration_count(self, obj):
        return obj.registrations.count()


class EventRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for EventRegistration model."""
    event_details = EventSerializer(source='event', read_only=True)
    student_details = UserSerializer(source='student', read_only=True)
    
    class Meta:
        model = EventRegistration
        fields = ['id', 'event', 'event_details', 'student', 'student_details',
                  'status', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
