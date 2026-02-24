"""Serializers for authentication."""

from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
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
    risk_status = serializers.SerializerMethodField()
    risk_score = serializers.SerializerMethodField()
    is_student_hr = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'hall_ticket', 'username', 'first_name', 'last_name', 'name',
            'role', 'phone', 'phone_number', 'registration_number',
            'profile_picture', 'is_active', 'created_at',
            'risk_status', 'risk_score', 'is_student_hr'
        ]
        read_only_fields = ['id', 'created_at', 'name']
    
    def get_name(self, obj):
        """Return full name."""
        full_name = obj.get_full_name()
        return full_name if full_name.strip() else obj.username

    def get_role(self, obj):
        """Return role from User model."""
        return obj.role
    
    def get_is_student_hr(self, obj):
        """Check if user belongs to Student_HR group (Optimized for prefetch)."""
        if hasattr(obj, '_prefetched_objects_cache') and 'groups' in obj._prefetched_objects_cache:
            return any(g.name == 'Student_HR' for g in obj.groups.all())
        return obj.groups.filter(name='Student_HR').exists()

    def get_risk_status(self, obj):
        if hasattr(obj, 'tenant'):
            return obj.tenant.risk_status
        return None

    def get_risk_score(self, obj):
        if hasattr(obj, 'tenant'):
            return obj.tenant.risk_score
        return 0


class UserDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for User model."""
    name = serializers.SerializerMethodField()
    phone = serializers.CharField(source='phone_number', allow_blank=True)
    hall_ticket = serializers.CharField(source='username', read_only=True)
    role = serializers.SerializerMethodField()
    risk_status = serializers.SerializerMethodField()
    risk_score = serializers.SerializerMethodField()
    is_student_hr = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'hall_ticket', 'username', 'first_name', 'last_name', 'name',
            'role', 'phone', 'phone_number', 'registration_number',
            'profile_picture', 'is_active', 'created_at', 'updated_at',
            'risk_status', 'risk_score', 'is_student_hr'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'name']
    
    def get_name(self, obj):
        """Return full name."""
        full_name = obj.get_full_name()
        return full_name if full_name.strip() else obj.username

    def get_role(self, obj):
        """Return role from User model."""
        return obj.role
        
    def get_is_student_hr(self, obj):
        """Check if user belongs to Student_HR group (Optimized for prefetch)."""
        if hasattr(obj, '_prefetched_objects_cache') and 'groups' in obj._prefetched_objects_cache:
            return any(g.name == 'Student_HR' for g in obj.groups.all())
        return obj.groups.filter(name='Student_HR').exists()

    def get_risk_status(self, obj):
        if hasattr(obj, 'tenant'):
            return obj.tenant.risk_status
        return None

    def get_risk_score(self, obj):
        if hasattr(obj, 'tenant'):
            return obj.tenant.risk_score
        return 0


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating new users."""

    hall_ticket = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(required=True, write_only=True)  # MANDATORY
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, required=True)
    
    # New Fields
    father_name = serializers.CharField(write_only=True, required=True)
    father_phone = serializers.CharField(write_only=True, required=True)
    mother_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    mother_phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    guardian_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    guardian_phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
    
    college_code = serializers.CharField(write_only=True, required=True) 
    address = serializers.CharField(write_only=True, required=True) 
    
    class Meta:
        model = User
        fields = [
            'hall_ticket', 'email', 'first_name', 'last_name',
            'phone_number', 'password', 'password_confirm',
            'father_name', 'father_phone', 
            'mother_name', 'mother_phone',
            'guardian_name', 'guardian_phone',
            'college_code', 'address'
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            'phone_number': {'required': True},
            'college_code': {'write_only': True, 'required': False},
            'address': {'write_only': True, 'required': False},
        }
    
    def validate_hall_ticket(self, value):
        """Check if hall ticket already exists."""
        normalized = (value or '').strip().upper()
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError('This hall ticket is already in use.')
        return normalized
    
    def validate_college_code(self, value):
        """Ensure college code exists in the system (created by SuperAdmin)."""
        from apps.colleges.models import College
        if not College.objects.filter(code=value).exists():
            raise serializers.ValidationError('Invalid college selection. Please choose a college from the list.')
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
        """Create user and associate Tenant data."""
        from apps.users.models import Tenant
        
        # Pop new fields
        father_name = validated_data.pop('father_name', '')
        father_phone = validated_data.pop('father_phone', '')
        mother_name = validated_data.pop('mother_name', '')
        mother_phone = validated_data.pop('mother_phone', '')
        guardian_name = validated_data.pop('guardian_name', '')
        guardian_phone = validated_data.pop('guardian_phone', '')
        
        college_code = validated_data.pop('college_code', '')
        address = validated_data.pop('address', '')
        
        validated_data.pop('password_confirm', None)
        password = validated_data.pop('password', None)
        hall_ticket = (validated_data.pop('hall_ticket') or '').strip().upper()

        user = User.objects.create_user(
            username=hall_ticket,
            registration_number=hall_ticket,
            password=password,
            is_active=True,
            **validated_data
        )

        group, _ = Group.objects.get_or_create(name='Student')
        user.groups.add(group)
        user.role = 'student'
        user.save(update_fields=['role'])
        
        # Signals might have already created it, but we update or create
        Tenant.objects.update_or_create(
            user=user,
            defaults={
                'father_name': father_name,
                'father_phone': father_phone,
                'mother_name': mother_name,
                'mother_phone': mother_phone,
                'guardian_name': guardian_name,
                'guardian_phone': guardian_phone,
                'college_code': college_code,
                'address': address,
            }
        )
        return user


class AdminUserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating users by Admins (supporting all roles)."""

    username = serializers.CharField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, required=True)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'first_name', 'last_name',
            'phone_number', 'password', 'password_confirm',
            'role', 'is_active'
        ]
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
            'phone_number': {'required': False},
        }

    def validate_username(self, value):
        normalized = (value or '').strip().upper()
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError('This username is already in use.')
        return normalized

    def validate(self, data):
        # Restriction: Only SuperAdmin can create other SuperAdmins
        request = self.context.get('request')
        request_user = request.user if request else None
        
        if data.get('role') == 'super_admin':
            if not request_user or not (request_user.role == 'super_admin' or request_user.is_superuser):
                raise serializers.ValidationError({'role': 'Only SuperAdmins can create other SuperAdmin accounts.'})

        if data.get('password') != data.get('password_confirm'):
            raise serializers.ValidationError({'password': 'Passwords do not match.'})
        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm', None)
        password = validated_data.pop('password')
        role = validated_data.get('role', 'student')
        
        # Ensure username is uppercase
        validated_data['username'] = validated_data['username'].upper()
        
        user = User.objects.create_user(password=password, **validated_data)
        
        # Assign group based on role
        group_map = {
            'student': 'Student',
            'staff': 'Staff',
            'admin': 'Admin',
            'super_admin': 'Admin', # Or SuperAdmin
            'warden': 'Warden',
            'head_warden': 'Head Warden',
            'chef': 'Chef',
            'head_chef': 'Chef',
            'gate_security': 'Gate Security',
            'security_head': 'Security Head'
        }
        
        group_name = group_map.get(role, 'Student')
        group, _ = Group.objects.get_or_create(name=group_name)
        user.groups.add(group)
        
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Custom JWT token serializer with user data."""
    
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # Add custom claims
        token['username'] = user.username
        token['role'] = user.role
        
        return token


class LoginSerializer(serializers.Serializer):
    """Serializer for login."""

    hall_ticket = serializers.CharField(required=False)
    username = serializers.CharField(required=False)
    password = serializers.CharField(write_only=True)
    
    def validate(self, data):
        """Authenticate user."""
        raw_ticket = data.get('hall_ticket') or data.get('username')
        hall_ticket = (raw_ticket or '').strip()
        if not hall_ticket:
            raise serializers.ValidationError({'detail': 'Hall ticket is required.'})
        password = data.get('password')

        # Primary path: treat hall tickets as case-insensitive and normalize to uppercase.
        normalized = hall_ticket.upper()
        user = authenticate(username=normalized, password=password)
        if not user and normalized != hall_ticket:
            # Back-compat for any legacy lowercase usernames in the DB.
            user = authenticate(username=hall_ticket, password=password)
        
        if not user:
            raise AuthenticationFailed('Invalid credentials.')

        # Enforce uppercase persistence once authenticated (best-effort).
        try:
            desired_username = (user.username or '').strip().upper()
            desired_reg = (user.registration_number or '').strip().upper() or desired_username
            update_fields = []
            if desired_username and user.username != desired_username:
                user.username = desired_username
                update_fields.append('username')
            if desired_reg and user.registration_number != desired_reg:
                user.registration_number = desired_reg
                update_fields.append('registration_number')
            if update_fields:
                user.save(update_fields=update_fields)
        except Exception:
            # Don't block login on normalization edge cases.
            pass
        
        data['user'] = user
        return data
