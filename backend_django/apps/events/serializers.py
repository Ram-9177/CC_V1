"""Events serializers."""

from rest_framework import serializers
from core.constants import AudienceTargets
from .models import (
    Event,
    EventActivityPoint,
    EventFeedback,
    EventRegistration,
    EventTicket,
)
from apps.auth.serializers import UserSerializer


class EventSerializer(serializers.ModelSerializer):
    """Serializer for Event model."""
    organizer_details = UserSerializer(source='organizer', read_only=True)
    registration_count = serializers.SerializerMethodField()
    waitlist_count = serializers.SerializerMethodField()
    vacancy = serializers.SerializerMethodField()
    participants = serializers.SerializerMethodField()
    share_url = serializers.SerializerMethodField()
    target_audience = serializers.ChoiceField(choices=Event.EVENT_AUDIENCE_CHOICES, default=AudienceTargets.ALL_STUDENTS)
    
    class Meta:
        model = Event
        fields = [
            'id', 'title', 'event_type', 'description', 'start_date', 'end_date',
            'location', 'organizer', 'organizer_details', 'max_participants',
            'min_players', 'court', 'is_match_ready', 'target_audience',
            'target_department', 'target_year', 'is_mandatory', 'external_link', 'image',
            'gallery_images', 'event_video', 'sponsor_logos', 'highlight_as_banner',
            'allow_registration', 'enable_attendance', 'enable_certificates',
            'enable_points', 'enable_waitlist', 'enable_reminders', 'points_value',
            'enable_tickets', 'ticket_price',
            'registration_count', 'waitlist_count', 'vacancy', 'share_url',
            'is_holiday', 'is_exam', 'participants', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'created_at', 'updated_at', 'registration_count',
            'waitlist_count', 'vacancy', 'participants', 'share_url'
        ]
    
    def get_registration_count(self, obj):
        if hasattr(obj, 'reg_count'):
            return obj.reg_count
        return obj.registrations.count()
        
    def get_vacancy(self, obj):
        if not obj.max_participants:
            return None
        reg_count = obj.reg_count if hasattr(obj, 'reg_count') else obj.registrations.filter(status='registered').count()
        return max(0, obj.max_participants - reg_count)

    def get_waitlist_count(self, obj):
        return obj.registrations.filter(status='waitlisted').count()

    def get_share_url(self, obj):
        request = self.context.get('request')
        if not request:
            return f"/api/events/events/{obj.id}/share/"
        return request.build_absolute_uri(f"/api/events/events/{obj.id}/share/")

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
                'status': r.status,
                'match_group': r.match_group_id
            } for r in obj.registrations.select_related('student').all()
        ]

    def validate(self, attrs):
        target = attrs.get('target_audience', getattr(self.instance, 'target_audience', None))
        department = attrs.get('target_department', getattr(self.instance, 'target_department', ''))
        year = attrs.get('target_year', getattr(self.instance, 'target_year', None))

        if target == AudienceTargets.SPECIFIC_DEPARTMENT and not department:
            raise serializers.ValidationError({'target_department': 'Required for specific_department audience.'})

        if target == AudienceTargets.SPECIFIC_YEAR and not year:
            raise serializers.ValidationError({'target_year': 'Required for specific_year audience.'})

        if year is not None and year <= 0:
            raise serializers.ValidationError({'target_year': 'Year must be a positive integer.'})

        return attrs


class EventRegistrationSerializer(serializers.ModelSerializer):
    """Serializer for EventRegistration model."""
    event_details = EventSerializer(source='event', read_only=True)
    student_details = UserSerializer(source='student', read_only=True)
    qr_data = serializers.ReadOnlyField()
    calendar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = EventRegistration
        fields = [
            'id', 'event', 'event_details', 'student', 'student_details',
            'status', 'qr_code_reference', 'qr_data', 'calendar_url', 'match_group_id', 'check_in_time',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'created_at', 'updated_at', 'qr_code_reference',
            'match_group_id', 'qr_data', 'calendar_url'
        ]

    def get_calendar_url(self, obj):
        request = self.context.get('request')
        if not request:
            return f"/api/events/events/{obj.event_id}/calendar/"
        return request.build_absolute_uri(f"/api/events/events/{obj.event_id}/calendar/")


class EventActivityPointSerializer(serializers.ModelSerializer):
    event_details = EventSerializer(source='event', read_only=True)
    student_details = UserSerializer(source='student', read_only=True)

    class Meta:
        model = EventActivityPoint
        fields = [
            'id', 'event', 'event_details', 'student', 'student_details',
            'registration', 'points', 'reason', 'awarded_by',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class EventFeedbackSerializer(serializers.ModelSerializer):
    event_details = EventSerializer(source='event', read_only=True)
    student_details = UserSerializer(source='student', read_only=True)

    class Meta:
        model = EventFeedback
        fields = [
            'id', 'event', 'event_details', 'student', 'student_details',
            'registration', 'rating', 'comment', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'student']


class EventTicketSerializer(serializers.ModelSerializer):
    event_details = EventSerializer(source='event', read_only=True)
    student_details = UserSerializer(source='student', read_only=True)
    qr_payload = serializers.SerializerMethodField()

    class Meta:
        model = EventTicket
        fields = [
            'id', 'event', 'event_details', 'student', 'student_details',
            'registration', 'amount', 'currency', 'payment_status', 'ticket_status',
            'payment_reference', 'qr_token', 'qr_payload', 'paid_at', 'used_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'created_at', 'updated_at', 'student', 'qr_token', 'qr_payload', 'paid_at', 'used_at'
        ]

    def get_qr_payload(self, obj):
        return {
            'ticket_id': obj.id,
            'event_id': obj.event_id,
            'student_id': obj.student_id,
            'qr_token': str(obj.qr_token),
        }
