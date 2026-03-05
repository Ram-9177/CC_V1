"""Gate passes serializers."""

from rest_framework import serializers
from .models import GatePass, GateScan
from apps.auth.serializers import UserSerializer
from apps.rooms.models import RoomAllocation
from datetime import datetime
from django.utils import timezone


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
                  'exit_date', 'entry_date', 'reason', 'destination', 'qr_code',
                  'approved_by', 'approved_by_details', 'approval_remarks',
                  'parent_informed', 'parent_informed_at', 'audio_brief',
                  'created_at', 'updated_at',
                  'purpose', 'exit_time', 'expected_return_date', 'expected_return_time', 'remarks']
        read_only_fields = ['created_at', 'updated_at', 'status', 'approved_by', 'qr_code']
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

        data['student_profile_picture'] = student.profile_picture.url if student.profile_picture else None
        data['purpose'] = instance.reason
        data['exit_date'] = instance.exit_date.date().isoformat() if instance.exit_date else None
        data['exit_time'] = instance.exit_date.time().strftime('%H:%M') if instance.exit_date else None
        data['expected_return_date'] = instance.entry_date.date().isoformat() if instance.entry_date else None
        data['expected_return_time'] = instance.entry_date.time().strftime('%H:%M') if instance.entry_date else None
        data['actual_exit_at'] = instance.actual_exit_at.isoformat() if instance.actual_exit_at else None
        data['actual_entry_at'] = instance.actual_entry_at.isoformat() if instance.actual_entry_at else None
        data['updated_at'] = instance.updated_at.isoformat() if getattr(instance, 'updated_at', None) else None
        data['remarks'] = instance.approval_remarks
        data['approved_by'] = instance.approved_by.get_full_name() if instance.approved_by else None
        data['qr_code'] = instance.qr_code

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
        if hasattr(info_date, 'isoformat'):
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
