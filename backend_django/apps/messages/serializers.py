"""Messages serializers."""

from rest_framework import serializers
from apps.auth.serializers import UserSerializer
from .models import Message


class MessageSerializer(serializers.ModelSerializer):
    sender_details = UserSerializer(source='sender', read_only=True)
    recipient_details = UserSerializer(source='recipient', read_only=True)

    def validate(self, attrs):
        """
        Enforce messaging rules:
        - Students can only message wardens/head wardens.
        - Only wardens/head wardens can message students.
        """
        request = self.context.get('request')
        sender = getattr(request, 'user', None)
        recipient = attrs.get('recipient')

        if sender and recipient:
            if sender == recipient:
                raise serializers.ValidationError({'recipient': 'You cannot message yourself.'})

            if sender.role == 'student' and recipient.role not in ('warden', 'head_warden'):
                raise serializers.ValidationError(
                    {'recipient': 'Students can only message the warden or head warden.'}
                )

            if recipient.role == 'student' and sender.role not in ('warden', 'head_warden'):
                raise serializers.ValidationError(
                    {'recipient': 'Only the warden or head warden can message students.'}
                )

        return attrs

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
