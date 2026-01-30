"""Messages serializers."""

from rest_framework import serializers
from apps.auth.serializers import UserSerializer
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_details = UserSerializer(source='sender', read_only=True)
    recipient_details = UserSerializer(source='recipient', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id',
            'sender',
            'sender_details',
            'recipient',
            'recipient_details',
            'subject',
            'body',
            'is_read',
            'read_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['sender', 'sender_details', 'recipient_details', 'read_at', 'created_at', 'updated_at']
