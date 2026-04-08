"""Gate passes serializers."""

from rest_framework import serializers
from .models import GatePass, GateScan
from apps.auth.serializers import UserSerializer
from apps.rooms.models import RoomAllocation
from datetime import datetime
from django.utils import timezone


def _localize(dt):
    """Return datetime in current timezone when aware; preserve naive values."""
    if not dt:
        return None
    if timezone.is_aware(dt):
        return timezone.localtime(dt)
    return dt


class GatePassSerializer(serializers.ModelSerializer):
    """Serializer for GatePass model."""
    student_details = UserSerializer(source='student', read_only=True)
    purpose = serializers.CharField(write_only=True, required=False, allow_blank=True)
    exit_date = serializers.DateField(write_only=True, required=False)
    exit_time = serializers.TimeField(write_only=True, required=False)
    expected_return_date = serializers.DateField(write_only=True, required=False)
    expected_return_time = serializers.TimeField(write_only=True, required=False)
    remarks = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    class Meta:
        model = GatePass
        fields = ['id', 'student', 'student_details', 'pass_type', 'status',
                  'exit_date', 'entry_date', 'reason', 'destination', 'qr_code',
                  'approved_by', 'approved_at', 'approval_remarks',
                  'movement_status',
                  'parent_informed', 'parent_informed_at', 'audio_brief', 'leave_application',
                  'late_minutes', 'late_count', 'student_type',
                  'created_at', 'updated_at',
                  'exit_time', 'entry_time', 'exit_security', 'entry_security',
                  'purpose', 'expected_return_date', 'expected_return_time', 'remarks']
        read_only_fields = ['created_at', 'updated_at', 'approved_by', 'qr_code', 
                            'approved_at', 'movement_status', 'late_minutes', 'late_count', 'leave_application',
                            'exit_time', 'entry_time', 'exit_security', 'entry_security']
        extra_kwargs = {
            # Student is set from request.user in the viewset.
            'student': {'read_only': True},
            # Defaults are applied in create() when these are not provided.
            'pass_type': {'required': False},
            'reason': {'required': False, 'allow_blank': True},
            'destination': {'required': False, 'allow_blank': True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)

        student = instance.student
        # FIX N+1: Strictly use pre-fetched data from 'active_allocation' to-attr
        room_number = "N/A"
        hostel_name = "N/A"
        
        # Access the pre-fetched list via to_attr
        active_allocs = getattr(student, 'active_allocation', [])
        if active_allocs and len(active_allocs) > 0:
            alloc = active_allocs[0]
            room_number = alloc.room.room_number
            try:
                hostel_name = alloc.room.building.hostel.name
            except (AttributeError, Exception):
                pass

        data['student_id'] = student.id
        data['student_name'] = student.get_full_name() or student.username
        data['student_hall_ticket'] = student.registration_number
        data['student_email'] = student.email
        data['student_phone'] = student.phone_number
        data['student_room'] = room_number
        data['hostel_name'] = hostel_name
        data['student_type'] = instance.student_type or student.student_type

        data['student_profile_picture'] = student.profile_picture.url if student.profile_picture else None
        exit_dt_local = _localize(instance.exit_date)
        entry_dt_local = _localize(instance.entry_date)
        actual_exit_local = _localize(instance.actual_exit_at)
        actual_entry_local = _localize(instance.actual_entry_at)
        approved_local = _localize(instance.approved_at)
        updated_local = _localize(getattr(instance, 'updated_at', None))

        data['purpose'] = instance.reason
        data['exit_date'] = exit_dt_local.date().isoformat() if exit_dt_local else None
        data['exit_time'] = exit_dt_local.time().strftime('%H:%M') if exit_dt_local else None
        data['expected_return_date'] = entry_dt_local.date().isoformat() if entry_dt_local else None
        data['expected_return_time'] = entry_dt_local.time().strftime('%H:%M') if entry_dt_local else None
        data['actual_exit_at'] = actual_exit_local.isoformat() if actual_exit_local else None
        data['actual_entry_at'] = actual_entry_local.isoformat() if actual_entry_local else None
        data['approved_at'] = approved_local.isoformat() if approved_local else None
        data['updated_at'] = updated_local.isoformat() if updated_local else None
        data['remarks'] = instance.approval_remarks
        data['approved_by'] = instance.approved_by.get_full_name() if instance.approved_by else None
        data['qr_code'] = instance.qr_code
        data['movement_status'] = instance.movement_status

        # Add parent contact info for Warden
        if hasattr(student, 'tenant'):
            data['parent_name'] = student.tenant.father_name or student.tenant.mother_name or student.tenant.guardian_name
            data['parent_phone'] = student.tenant.father_phone or student.tenant.mother_phone or student.tenant.guardian_phone
            data['father_name'] = student.tenant.father_name
            data['father_phone'] = student.tenant.father_phone
            data['mother_name'] = student.tenant.mother_name
            data['mother_phone'] = student.tenant.mother_phone
            data['guardian_name'] = student.tenant.guardian_name
            data['guardian_phone'] = student.tenant.guardian_phone
        else:
            data['parent_name'] = None
            data['parent_phone'] = None
            
        # Update informed field safely natively intelligently intelligently effortlessly predictably gracefully safely optimally smartly seamlessly.
        data['parent_informed'] = instance.parent_informed
        
        info_date = getattr(instance, 'parent_informed_at', None)
        if info_date and hasattr(info_date, 'isoformat'):
            data['parent_informed_at'] = info_date.isoformat()
        else:
            data['parent_informed_at'] = str(info_date) if info_date else None

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
            exit_dt = datetime.combine(exit_date, exit_time)
        elif exit_date:
            exit_dt = datetime.combine(exit_date, datetime.min.time())
        else:
            exit_dt = None

        if exit_dt is not None and timezone.is_naive(exit_dt):
            exit_dt = timezone.make_aware(exit_dt, timezone.get_current_timezone())
        if exit_dt is not None:
            validated_data['exit_date'] = exit_dt

        if expected_return_date and expected_return_time:
            entry_dt = datetime.combine(expected_return_date, expected_return_time)
        elif expected_return_date:
            entry_dt = datetime.combine(expected_return_date, datetime.min.time())
        else:
            entry_dt = None

        if entry_dt is not None and timezone.is_naive(entry_dt):
            entry_dt = timezone.make_aware(entry_dt, timezone.get_current_timezone())
        if entry_dt is not None:
            validated_data['entry_date'] = entry_dt

        if purpose:
            validated_data['reason'] = purpose
        elif not validated_data.get('reason'):
            validated_data['reason'] = 'General'

        if remarks:
            validated_data['approval_remarks'] = remarks

        # Tenant isolation validation
        student = validated_data.get('student')
        request = self.context.get('request')
        if student and request and request.user.is_authenticated:
            user = request.user
            # Ensure staff cannot create passes for students outside their college
            if not getattr(user, 'is_superuser', False) and getattr(user, 'college_id', None) != getattr(student, 'college_id', None):
                raise serializers.ValidationError({'student': 'Security Error: You cannot create a gate pass for a student outside your college.'})

        return super().create(validated_data)


class GateScanSerializer(serializers.ModelSerializer):
    """Serializer for GateScan model."""
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    student_photo = serializers.ImageField(source='student.profile_picture', read_only=True)
    student_room = serializers.SerializerMethodField()
    verified = serializers.SerializerMethodField()

    def get_verified(self, obj):
        return True

    def get_student_room(self, obj):
        # Optimization: Try to use pre-fetched data if available to avoid N+1
        if hasattr(obj.student, 'active_allocation'):
             allocs = obj.student.active_allocation
             if allocs:
                 return allocs[0].room.room_number
        
        # Fallback query
        allocation = RoomAllocation.objects.filter(student=obj.student, end_date__isnull=True).select_related('room').first()
        return allocation.room.room_number if allocation else "N/A"

    class Meta:
        model = GateScan
        fields = ['id', 'gate_pass', 'student', 'student_name', 'student_photo', 'student_room',
                  'direction', 'scan_time', 'qr_code', 'location', 'created_at', 'updated_at', 'verified']
        read_only_fields = ['created_at', 'updated_at', 'scan_time']
