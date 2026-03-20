"""Colleges serializers."""

from rest_framework import serializers
from .models import College, CollegeModuleConfig


class CollegeModuleConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = CollegeModuleConfig
        fields = ['id', 'module_name', 'is_enabled', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class CollegeSerializer(serializers.ModelSerializer):
    """Full serializer for College — used by super_admin and college admin."""

    user_count = serializers.SerializerMethodField()
    module_configs = CollegeModuleConfigSerializer(many=True, read_only=True)
    at_user_limit = serializers.SerializerMethodField()

    class Meta:
        model = College
        fields = [
            'id', 'name', 'code', 'city', 'state',
            'contact_email', 'contact_phone', 'website',
            'is_active', 'disabled_reason',
            # SaaS fields
            'subscription_status', 'max_users', 'logo', 'primary_color',
            # Computed
            'user_count', 'at_user_limit', 'module_configs',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'user_count', 'at_user_limit']

    def get_user_count(self, obj):
        return obj.users.count() if hasattr(obj, 'users') else 0

    def get_at_user_limit(self, obj):
        return obj.is_at_user_limit()


class CollegePublicSerializer(serializers.ModelSerializer):
    """Minimal read-only serializer — safe to expose to any authenticated user."""

    class Meta:
        model = College
        fields = ['id', 'name', 'code', 'logo', 'primary_color', 'is_active']
        read_only_fields = fields
