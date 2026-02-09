from rest_framework import serializers
from .models import VisitorLog
from apps.auth.serializers import UserSerializer

class VisitorLogSerializer(serializers.ModelSerializer):
    student_details = UserSerializer(source='student', read_only=True)

    class Meta:
        model = VisitorLog
        fields = [
            'id', 'student', 'student_details', 'visitor_name', 'relationship',
            'phone_number', 'purpose', 'check_in', 'check_out',
            'id_proof_number', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['check_in', 'created_at', 'updated_at']
