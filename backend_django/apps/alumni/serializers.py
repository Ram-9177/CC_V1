"""Alumni app serializers — Phase 8."""
from rest_framework import serializers
from .models import AlumniProfile, Mentorship
from apps.auth.serializers import UserSerializer

class AlumniProfileSerializer(serializers.ModelSerializer):
    """Alumni profile serializer."""
    user_details = UserSerializer(source='user', read_only=True)
    
    class Meta:
        model = AlumniProfile
        fields = '__all__'
        read_only_fields = ['user', 'created_at', 'updated_at']

class MentorshipSerializer(serializers.ModelSerializer):
    """Mentorship relationship serializer."""
    mentor_details = UserSerializer(source='mentor', read_only=True)
    student_details = UserSerializer(source='student', read_only=True)
    
    class Meta:
        model = Mentorship
        fields = '__all__'
        read_only_fields = ['mentor', 'student', 'created_at', 'updated_at']
