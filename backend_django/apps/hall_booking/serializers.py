"""Serializers for hall booking module."""

from rest_framework import serializers

from .models import Hall, HallBooking


class HallSerializer(serializers.ModelSerializer):
    """Serializer for Hall."""

    class Meta:
        model = Hall
        fields = [
            'id',
            'hall_id',
            'hall_name',
            'capacity',
            'location',
            'facilities',
            'manager',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class HallBookingSerializer(serializers.ModelSerializer):
    """Serializer for HallBooking."""

    hall_details = HallSerializer(source='hall', read_only=True)
    requester_name = serializers.SerializerMethodField()
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = HallBooking
        fields = [
            'id',
            'hall',
            'hall_details',
            'requester',
            'requester_name',
            'booking_date',
            'start_time',
            'end_time',
            'event_name',
            'status',
            'reviewed_by',
            'reviewer_name',
            'review_note',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'requester',
            'status',
            'reviewed_by',
            'reviewed_at',
            'created_at',
            'updated_at',
        ]

    def get_requester_name(self, obj):
        return obj.requester.get_full_name() or obj.requester.username

    def get_reviewer_name(self, obj):
        if not obj.reviewed_by:
            return None
        return obj.reviewed_by.get_full_name() or obj.reviewed_by.username

    def validate(self, attrs):
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')
        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})

        hall = attrs.get('hall')
        booking_date = attrs.get('booking_date')
        if hall and booking_date and start_time and end_time:
            blocked_statuses = [HallBooking.STATUS_PENDING, HallBooking.STATUS_APPROVED]
            qs = HallBooking.objects.filter(
                hall=hall,
                booking_date=booking_date,
                status__in=blocked_statuses,
                start_time__lt=end_time,
                end_time__gt=start_time,
            )

            instance = getattr(self, 'instance', None)
            if instance is not None:
                qs = qs.exclude(pk=instance.pk)

            if qs.exists():
                raise serializers.ValidationError(
                    'This hall is already booked for the selected date and time range.'
                )

        return attrs
