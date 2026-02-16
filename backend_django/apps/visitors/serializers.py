from rest_framework import serializers
from .models import VisitorLog, VisitorPreRegistration
from apps.auth.serializers import UserSerializer

class VisitorLogSerializer(serializers.ModelSerializer):
    student_details = UserSerializer(source='student', read_only=True)

    class Meta:
        model = VisitorLog
        fields = [
            'id', 'student', 'student_details', 'visitor_name', 'relationship',
            'phone_number', 'purpose', 'check_in', 'check_out',
            'id_proof_number', 'is_active', 'photo_url', 'pre_registration',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['check_in', 'created_at', 'updated_at']


class VisitorPreRegistrationSerializer(serializers.ModelSerializer):
    student_details = UserSerializer(source='student', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, default=None)

    class Meta:
        model = VisitorPreRegistration
        fields = [
            'id', 'student', 'student_details', 'visitor_name', 'relationship',
            'phone_number', 'purpose', 'expected_date', 'expected_time',
            'id_proof_number', 'status', 'approved_by', 'approved_by_name',
            'rejection_reason', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'approved_by', 'created_at', 'updated_at']
