"""Serializers for authentication."""

from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.models import Group
from apps.auth.models import User
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    name = serializers.SerializerMethodField()
    phone = serializers.CharField(source='phone_number', allow_blank=True)
    hall_ticket = serializers.CharField(source='username', read_only=True)
    role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'hall_ticket', 'username', 'first_name', 'last_name', 'name',
            'role', 'phone', 'phone_number', 'registration_number',
            'profile_picture', 'is_active', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'name']
    
    def get_name(self, obj):
        """Return full name."""
        full_name = obj.get_full_name()
        return full_name if full_name.strip() else obj.username

    def get_role(self, obj):
        """Return role from Django Groups."""
        if obj.is_superuser or obj.is_staff:
            return 'admin'
        if obj.groups.filter(name='Admin').exists():
            return 'admin'
        if obj.groups.filter(name='Staff').exists():
            return 'staff'
        if obj.groups.filter(name='Student').exists():
            return 'student'
        return 'student'


class UserDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for User model."""
    name = serializers.SerializerMethodField()
    phone = serializers.CharField(source='phone_number', allow_blank=True)
    hall_ticket = serializers.CharField(source='username', read_only=True)
    role = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'hall_ticket', 'username', 'first_name', 'last_name', 'name',
            'role', 'phone', 'phone_number', 'registration_number',
            'profile_picture', 'is_active', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'name']
    
    def get_name(self, obj):
        """Return full name."""
        full_name = obj.get_full_name()
        return full_name if full_name.strip() else obj.username

    def get_role(self, obj):
        """Return role from Django Groups."""
        if obj.is_superuser or obj.is_staff:
            return 'admin'
        if obj.groups.filter(name='Admin').exists():
            return 'admin'
        if obj.groups.filter(name='Staff').exists():
            return 'staff'
        if obj.groups.filter(name='Student').exists():
            return 'student'
        return 'student'


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users."""

    hall_ticket = serializers.CharField(write_only=True, required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = [
            'hall_ticket', 'first_name', 'last_name',
            'phone_number', 'password', 'password_confirm'
        ]
    
    def validate_hall_ticket(self, value):
        """Check if hall ticket already exists."""
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This hall ticket is already in use.')
        return value
    
    def validate(self, data):
        """Validate password confirmation."""
        password = data.get('password')
        password_confirm = data.get('password_confirm')
        
        if password != password_confirm:
            raise serializers.ValidationError({
                'password': 'Passwords do not match.'
            })
        return data
    
    def create(self, validated_data):
        """Create user with hashed password."""
        validated_data.pop('password_confirm', None)
        password = validated_data.pop('password', None)
        hall_ticket = validated_data.pop('hall_ticket')

        user = User.objects.create_user(
            username=hall_ticket,
            registration_number=hall_ticket,
            password=password,
            **validated_data
        )

        group, _ = Group.objects.get_or_create(name='Student')
        user.groups.add(group)
        user.role = 'student'
        user.save(update_fields=['role'])
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT token serializer with user data."""
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add custom claims
        token['username'] = user.username
        if user.is_superuser or user.is_staff:
            token['role'] = 'admin'
        elif user.groups.filter(name='Admin').exists():
            token['role'] = 'admin'
        elif user.groups.filter(name='Staff').exists():
            token['role'] = 'staff'
        else:
            token['role'] = 'student'
        
        return token


class LoginSerializer(serializers.Serializer):
    """Serializer for login."""

    hall_ticket = serializers.CharField(required=False)
    username = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True)
    
    def validate(self, data):
        """Authenticate user."""
        hall_ticket = data.get('hall_ticket') or data.get('username')
        if not hall_ticket:
            raise serializers.ValidationError({'detail': 'Hall ticket is required.'})
        user = authenticate(
            username=hall_ticket,
            password=data.get('password')
        )
        
        if not user:
            raise serializers.ValidationError({
                'detail': 'Invalid credentials.'
            })
        
        data['user'] = user
        return data
