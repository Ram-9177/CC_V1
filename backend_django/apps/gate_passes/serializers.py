"""Gate passes serializers."""

from rest_framework import serializers
from .models import GatePass, GateScan
from apps.auth.serializers import UserSerializer
from apps.rooms.models import RoomAllocation
from datetime import datetime


class GatePassSerializer(serializers.ModelSerializer):
    """Serializer for GatePass model."""
    student_details = UserSerializer(source='student', read_only=True)
    approved_by_details = UserSerializer(source='approved_by', read_only=True)
    purpose = serializers.CharField(write_only=True, required=False, allow_blank=True)
    exit_date = serializers.DateField(write_only=True, required=False)
    exit_time = serializers.TimeField(write_only=True, required=False)
    expected_return_date = serializers.DateField(write_only=True, required=False)
    expected_return_time = serializers.TimeField(write_only=True, required=False)
    remarks = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = GatePass
        fields = ['id', 'student', 'student_details', 'pass_type', 'status',
                  'exit_date', 'entry_date', 'reason', 'destination',
                  'approved_by', 'approved_by_details', 'approval_remarks',
                  'created_at', 'updated_at',
                  'purpose', 'exit_time', 'expected_return_date', 'expected_return_time', 'remarks']
        read_only_fields = ['created_at', 'updated_at', 'status', 'approved_by']

    def to_representation(self, instance):
        data = super().to_representation(instance)

        student = instance.student
        allocation = RoomAllocation.objects.filter(student=student, end_date__isnull=True).select_related('room').first()
        room_number = allocation.room.room_number if allocation else None

        data['student'] = {
            'id': student.id,
            'name': student.get_full_name() or student.username,
            'email': student.email,
            'room_number': room_number,
        }
        data['purpose'] = instance.reason
        data['exit_date'] = instance.exit_date.date().isoformat() if instance.exit_date else None
        data['exit_time'] = instance.exit_date.time().strftime('%H:%M') if instance.exit_date else None
        data['expected_return_date'] = instance.entry_date.date().isoformat() if instance.entry_date else None
        data['expected_return_time'] = instance.entry_date.time().strftime('%H:%M') if instance.entry_date else None
        data['remarks'] = instance.approval_remarks
        data['approved_by'] = instance.approved_by.get_full_name() if instance.approved_by else None

        return data

    def create(self, validated_data):
        purpose = validated_data.pop('purpose', '')
        exit_date = validated_data.pop('exit_date', None)
        exit_time = validated_data.pop('exit_time', None)
        expected_return_date = validated_data.pop('expected_return_date', None)
        expected_return_time = validated_data.pop('expected_return_time', None)
        remarks = validated_data.pop('remarks', '')

        if not exit_date:
            raise serializers.ValidationError({'exit_date': 'exit_date is required.'})

        if not validated_data.get('pass_type'):
            validated_data['pass_type'] = 'day'

        if not validated_data.get('destination'):
            validated_data['destination'] = 'Offsite'

        if exit_date and exit_time:
            validated_data['exit_date'] = datetime.combine(exit_date, exit_time)
        elif exit_date:
            validated_data['exit_date'] = datetime.combine(exit_date, datetime.min.time())

        if expected_return_date and expected_return_time:
            validated_data['entry_date'] = datetime.combine(expected_return_date, expected_return_time)
        elif expected_return_date:
            validated_data['entry_date'] = datetime.combine(expected_return_date, datetime.min.time())

        if purpose:
            validated_data['reason'] = purpose
        elif not validated_data.get('reason'):
            validated_data['reason'] = 'General'

        if remarks:
            validated_data['approval_remarks'] = remarks

        return super().create(validated_data)


class GateScanSerializer(serializers.ModelSerializer):
    """Serializer for GateScan model."""
    student_details = UserSerializer(source='student', read_only=True)
    
    class Meta:
        model = GateScan
        fields = ['id', 'gate_pass', 'student', 'student_details', 'direction', 
                  'scan_time', 'qr_code', 'location', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'scan_time']
