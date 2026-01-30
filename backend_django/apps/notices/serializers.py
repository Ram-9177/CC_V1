"""Notices serializers."""

from rest_framework import serializers
from .models import Notice
from apps.auth.serializers import UserSerializer


class NoticeSerializer(serializers.ModelSerializer):
    """Serializer for Notice model."""
    author_details = UserSerializer(source='author', read_only=True)
    created_by = serializers.SerializerMethodField()
    is_pinned = serializers.SerializerMethodField()
    category = serializers.CharField(write_only=True, required=False)
    created_at = serializers.DateTimeField(read_only=True)
    
    class Meta:
        model = Notice
        fields = ['id', 'title', 'content', 'priority', 'author', 'author_details',
                  'is_published', 'published_date', 'expires_at', 'target_audience',
                  'created_at', 'updated_at', 'created_by', 'is_pinned', 'category']
        read_only_fields = ['created_at', 'updated_at', 'published_date']

    def get_created_by(self, obj):
        if not obj.author:
            return {'id': None, 'name': 'System', 'role': 'system'}
        return {
            'id': obj.author.id,
            'name': obj.author.get_full_name() or obj.author.username,
            'role': obj.author.role,
        }

    def get_is_pinned(self, obj):
        return False

    def create(self, validated_data):
        category = validated_data.pop('category', None)
        if category and not validated_data.get('target_audience'):
            validated_data['target_audience'] = 'all'
        return super().create(validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['category'] = 'general'
        return data
