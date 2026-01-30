"""Colleges serializers."""

from rest_framework import serializers
from .models import College


class CollegeSerializer(serializers.ModelSerializer):
    """Serializer for College model."""
    
    class Meta:
        model = College
        fields = ['id', 'name', 'code', 'city', 'state', 'contact_email',
                  'contact_phone', 'website', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']
