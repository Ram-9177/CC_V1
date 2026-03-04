"""Colleges serializers."""

from rest_framework import serializers
from .models import College


class CollegeSerializer(serializers.ModelSerializer):
    """Serializer for College model."""
    
    user_count = serializers.SerializerMethodField()
    
    class Meta:
        model = College
        fields = ['id', 'name', 'code', 'city', 'state', 'contact_email',
                  'contact_phone', 'website', 'is_active', 'disabled_reason',
                  'user_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at', 'user_count']

    def get_user_count(self, obj):
        """Return count of users belonging to this college."""
        return obj.users.count() if hasattr(obj, 'users') else 0
