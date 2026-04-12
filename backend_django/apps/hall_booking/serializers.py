"""Serializers for hall booking module."""

from rest_framework import serializers

from .models import (
    Hall,
    HallAttendance,
    HallBooking,
    HallEquipment,
    HallEquipmentBooking,
    HallSlot,
)


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
            'status',
            'manager',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class HallSlotSerializer(serializers.ModelSerializer):
    hall_name = serializers.CharField(source='hall.hall_name', read_only=True)

    class Meta:
        model = HallSlot
        fields = [
            'id',
            'hall',
            'hall_name',
            'start_time',
            'end_time',
            'status',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class HallEquipmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = HallEquipment
        fields = [
            'id',
            'name',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class HallAttendanceSerializer(serializers.ModelSerializer):
    scanned_by_name = serializers.SerializerMethodField()

    class Meta:
        model = HallAttendance
        fields = [
            'id',
            'booking',
            'attendee_name',
            'attendee_identifier',
            'scan_method',
            'scanned_by',
            'scanned_by_name',
            'created_at',
        ]
        read_only_fields = ['created_at']

    def get_scanned_by_name(self, obj):
        if not obj.scanned_by:
            return None
        return obj.scanned_by.get_full_name() or obj.scanned_by.username


class HallBookingSerializer(serializers.ModelSerializer):
    """Serializer for HallBooking."""

    hall_details = HallSerializer(source='hall', read_only=True)
    slot_details = HallSlotSerializer(source='slot', read_only=True)
    requester_name = serializers.SerializerMethodField()
    reviewer_name = serializers.SerializerMethodField()
    requested_equipment = serializers.PrimaryKeyRelatedField(
        queryset=HallEquipment.objects.filter(is_active=True),
        many=True,
        required=False,
    )
    requested_equipment_details = HallEquipmentSerializer(source='requested_equipment', many=True, read_only=True)
    event_title = serializers.CharField(source='event_name', required=False)

    class Meta:
        model = HallBooking
        fields = [
            'id',
            'hall',
            'hall_details',
            'slot',
            'slot_details',
            'requester',
            'requester_name',
            'booking_date',
            'start_time',
            'end_time',
            'event_name',
            'event_title',
            'department',
            'expected_participants',
            'description',
            'status',
            'target_audience',
            'target_departments',
            'target_batches',
            'qr_token',
            'reviewed_by',
            'reviewer_name',
            'review_note',
            'reviewed_at',
            'cancelled_at',
            'requested_equipment',
            'requested_equipment_details',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'requester',
            'status',
            'reviewed_by',
            'reviewed_at',
            'cancelled_at',
            'qr_token',
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
        attrs = dict(attrs)

        slot = attrs.get('slot')
        hall = attrs.get('hall')
        booking_date = attrs.get('booking_date')
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')

        # Backward compatibility: if slot is provided, derive hall/date/time from payload.
        if slot is not None:
            attrs['hall'] = slot.hall
            hall = slot.hall
            attrs['start_time'] = slot.start_time
            attrs['end_time'] = slot.end_time
            start_time = slot.start_time
            end_time = slot.end_time

        # Require either explicit hall/date/time, or slot+date.
        if not hall:
            raise serializers.ValidationError({'hall': 'Hall is required.'})
        if not booking_date:
            raise serializers.ValidationError({'booking_date': 'Booking date is required.'})
        if not start_time or not end_time:
            raise serializers.ValidationError({'start_time': 'Start/end time are required.'})

        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({'end_time': 'End time must be after start time.'})

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

        expected = attrs.get('expected_participants')
        if expected and hall and expected > hall.capacity:
            raise serializers.ValidationError({'expected_participants': 'Expected participants exceed hall capacity.'})

        equipment_list = attrs.get('requested_equipment', [])
        if equipment_list:
            blocked_statuses = [HallBooking.STATUS_PENDING, HallBooking.STATUS_APPROVED]
            for equipment in equipment_list:
                conflict_qs = HallEquipmentBooking.objects.filter(
                    equipment=equipment,
                    booking__booking_date=booking_date,
                    booking__status__in=blocked_statuses,
                    booking__start_time__lt=end_time,
                    booking__end_time__gt=start_time,
                )
                instance = getattr(self, 'instance', None)
                if instance is not None:
                    conflict_qs = conflict_qs.exclude(booking_id=instance.pk)
                if conflict_qs.exists():
                    raise serializers.ValidationError(
                        {'requested_equipment': f'Equipment conflict: {equipment.name} is already allocated for an overlapping booking.'}
                    )

        return attrs

    def create(self, validated_data):
        equipment_list = validated_data.pop('requested_equipment', [])
        booking = HallBooking.objects.create(**validated_data)
        if equipment_list:
            booking.requested_equipment.set(equipment_list)
        return booking

    def update(self, instance, validated_data):
        equipment_list = validated_data.pop('requested_equipment', None)
        booking = super().update(instance, validated_data)
        if equipment_list is not None:
            booking.requested_equipment.set(equipment_list)
        return booking
