"""Serializers for authentication."""
# pyre-ignore-all-errors

from rest_framework import serializers # type: ignore # pyre-ignore
from rest_framework.exceptions import AuthenticationFailed # type: ignore # pyre-ignore
import logging
logger = logging.getLogger(__name__)

from django.contrib.auth import authenticate # type: ignore # pyre-ignore
from django.contrib.auth.models import Group # type: ignore # pyre-ignore
from django.db.models import Q # type: ignore # pyre-ignore
from apps.auth.models import User # type: ignore # pyre-ignore
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer # type: ignore # pyre-ignore
from core.constants import TOP_LEVEL_ROLES, UserRoles


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model."""
    name = serializers.SerializerMethodField()
    phone = serializers.CharField(source='phone_number', allow_blank=True)
    hall_ticket = serializers.CharField(source='username', read_only=True)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=False)
    risk_status = serializers.SerializerMethodField()
    risk_score = serializers.SerializerMethodField()
    is_student_hr = serializers.SerializerMethodField()
    college_name = serializers.SerializerMethodField()
    college_code = serializers.SerializerMethodField()
    college_is_active = serializers.SerializerMethodField()
    college_logo = serializers.SerializerMethodField()
    college_primary_color = serializers.SerializerMethodField()
    student_status = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'hall_ticket', 'username', 'email', 'first_name', 'last_name', 'name',
            'role', 'phone', 'phone_number', 'registration_number',
            'college', 'college_name', 'college_code', 'college_is_active',
            'college_logo', 'college_primary_color',
            'department', 'year', 'semester', 'hostel', 'student_type',
            'profile_picture', 'is_active', 'is_approved', 'created_at',
            'risk_status', 'risk_score', 'is_student_hr', 'student_status', 'is_on_campus', 'custom_location',
            'can_access_all_blocks'
        ]
        read_only_fields = ['id', 'created_at', 'name']
        extra_kwargs = {
            'email': {'required': True, 'allow_blank': False},
            'first_name': {'required': True, 'allow_blank': False},
            'last_name': {'required': True, 'allow_blank': False},
            'phone_number': {'required': True, 'allow_blank': False},
        }
    
    def get_name(self, obj):
        full_name = obj.get_full_name()
        return full_name if full_name.strip() else obj.username

    def get_role(self, obj):
        return obj.role
    
    def get_is_student_hr(self, obj):
        return getattr(obj, 'is_student_hr', False)

    def get_risk_status(self, obj):
        if hasattr(obj, 'tenant'):
            return obj.tenant.risk_status
        return None

    def get_risk_score(self, obj):
        if hasattr(obj, 'tenant'):
            return obj.tenant.risk_score
        return 0

    def get_college_name(self, obj):
        return obj.college.name if obj.college else None

    def get_college_code(self, obj):
        return obj.college.code if obj.college else None

    def get_college_is_active(self, obj):
        return obj.college.is_active if obj.college else True

    def get_college_logo(self, obj):
        if obj.college and obj.college.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.college.logo.url)
            return obj.college.logo.url
        return None

    def get_college_primary_color(self, obj):
        return obj.college.primary_color if obj.college else ''

    def get_student_status(self, obj):
        if obj.role != UserRoles.STUDENT:
            return None
        from apps.gate_passes.models import GatePass # type: ignore # pyre-ignore
        return 'OUTSIDE_HOSTEL' if GatePass.objects.filter(student=obj, movement_status='outside').exists() else 'IN_HOSTEL'


class UserDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for User model."""
    name = serializers.SerializerMethodField()
    phone = serializers.CharField(source='phone_number', allow_blank=True)
    hall_ticket = serializers.CharField(source='username', read_only=True)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=False)
    risk_status = serializers.SerializerMethodField()
    risk_score = serializers.SerializerMethodField()
    is_student_hr = serializers.SerializerMethodField()
    college_name = serializers.SerializerMethodField()
    college_code = serializers.SerializerMethodField()
    college_is_active = serializers.SerializerMethodField()
    college_logo = serializers.SerializerMethodField()
    college_primary_color = serializers.SerializerMethodField()
    student_status = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            'id', 'hall_ticket', 'username', 'email', 'first_name', 'last_name', 'name',
            'role', 'phone', 'phone_number', 'registration_number',
            'college', 'college_name', 'college_code', 'college_is_active',
            'college_logo', 'college_primary_color',
            'department', 'year', 'semester', 'hostel', 'student_type',
            'profile_picture', 'is_active', 'is_approved', 'created_at', 'updated_at',
            'risk_status', 'risk_score', 'is_student_hr', 'student_status', 'is_on_campus', 'custom_location',
            'can_access_all_blocks'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'name']
        extra_kwargs = {
            'email': {'required': True, 'allow_blank': False},
            'first_name': {'required': True, 'allow_blank': False},
            'last_name': {'required': True, 'allow_blank': False},
            'phone_number': {'required': True, 'allow_blank': False},
        }
    
    def get_name(self, obj):
        full_name = obj.get_full_name()
        return full_name if full_name.strip() else obj.username

    def get_role(self, obj):
        return obj.role
        
    def get_is_student_hr(self, obj):
        return getattr(obj, 'is_student_hr', False)

    def get_risk_status(self, obj):
        if hasattr(obj, 'tenant'):
            return obj.tenant.risk_status
        return None

    def get_risk_score(self, obj):
        if hasattr(obj, 'tenant'):
            return obj.tenant.risk_score
        return 0

    def get_college_name(self, obj):
        return obj.college.name if obj.college else None

    def get_college_code(self, obj):
        return obj.college.code if obj.college else None

    def get_college_is_active(self, obj):
        return obj.college.is_active if obj.college else True

    def get_college_logo(self, obj):
        if obj.college and obj.college.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.college.logo.url)
            return obj.college.logo.url
        return None

    def get_college_primary_color(self, obj):
        return obj.college.primary_color if obj.college else ''

    def get_student_status(self, obj):
        if obj.role != UserRoles.STUDENT:
            return None
        from apps.gate_passes.models import GatePass # type: ignore # pyre-ignore
        return 'OUTSIDE_HOSTEL' if GatePass.objects.filter(student=obj, movement_status='outside').exists() else 'IN_HOSTEL'


class UserCreateSerializer(serializers.ModelSerializer):

    hall_ticket = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(required=True, write_only=True)  # MANDATORY
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, required=True)
    
    # New Fields
    father_name = serializers.CharField(write_only=True, required=False, allow_blank=True)
    father_phone = serializers.CharField(write_only=True, required=False, allow_blank=True)
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
            'college_code', 'address', 'is_on_campus', 'custom_location'
        ]
        extra_kwargs = {
            'email': {'required': True, 'allow_blank': False},
            'first_name': {'required': True, 'allow_blank': False},
            'last_name': {'required': True, 'allow_blank': False},
            'phone_number': {'required': True, 'allow_blank': False},
            'college_code': {'write_only': True, 'required': True, 'allow_blank': False},
            'address': {'write_only': True, 'required': True, 'allow_blank': False},
            'is_on_campus': {'required': False},
            'custom_location': {'required': False, 'allow_blank': True},
        }
    
    def validate_hall_ticket(self, value):
        """Check if hall ticket already exists."""
        normalized = (value or '').strip().upper()
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError('This hall ticket is already in use.')
        return normalized
    
    def validate_college_code(self, value):
        """Ensure college code exists and has not hit its user limit."""
        from apps.colleges.models import College # type: ignore # pyre-ignore
        college = College.objects.filter(code=value).first()
        if not college:
            raise serializers.ValidationError('Invalid college selection. Please choose a college from the list.')
        if college.is_at_user_limit():
            raise serializers.ValidationError(
                f'This college has reached its maximum user limit ({college.max_users}). '
                'Please contact your administrator.'
            )
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
        from apps.users.models import Tenant # type: ignore # pyre-ignore
        
        # Pop new fields
        father_name = validated_data.pop('father_name', '')
        father_phone = validated_data.pop('father_phone', '')
        mother_name = validated_data.pop('mother_name', '')
        mother_phone = validated_data.pop('mother_phone', '')
        guardian_name = validated_data.pop('guardian_name', '')
        guardian_phone = validated_data.pop('guardian_phone', '')
        
        college_code = validated_data.pop('college_code', '')
        from apps.colleges.models import College # type: ignore # pyre-ignore
        college = College.objects.filter(code=college_code).first()
        
        address = validated_data.pop('address', '')
        
        validated_data.pop('password_confirm', None)
        password = validated_data.pop('password', None)
        hall_ticket = (validated_data.pop('hall_ticket') or '').strip().upper()

        user = User.objects.create_user(
            username=hall_ticket,
            registration_number=hall_ticket,
            password=password,
            college=college,
            is_active=False,
            is_approved=False,
            is_password_changed=True,
            **validated_data
        )

        group, _ = Group.objects.get_or_create(name='Student')
        user.groups.add(group)
        user.role = UserRoles.STUDENT
        user.save(update_fields=['role', 'college'])
        
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
    email = serializers.EmailField(required=True)
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, required=True)
    role = serializers.ChoiceField(choices=User.ROLE_CHOICES, required=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'phone_number', 'password', 'password_confirm',
            'role', 'department', 'year', 'semester', 'hostel', 'student_type', 'is_active', 'college',
            'is_on_campus', 'custom_location', 'can_access_all_blocks'
        ]
        extra_kwargs = {
            'email': {'required': True, 'allow_blank': False},
            'first_name': {'required': True, 'allow_blank': False},
            'last_name': {'required': True, 'allow_blank': False},
            'phone_number': {'required': True, 'allow_blank': False},
            'is_on_campus': {'required': False},
            'custom_location': {'required': False, 'allow_blank': True},
            'year': {'required': False},
            'semester': {'required': False},
        }

    def validate_username(self, value):
        normalized = (value or '').strip().upper()
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError('This username is already in use.')
        return normalized

    def validate_email(self, value):
        normalized = (value or '').strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError('This email is already in use.')
        return normalized

    def validate(self, data):
        # Restriction: Only SuperAdmin can create other SuperAdmins
        request = self.context.get('request')
        request_user = request.user if request else None
        
        if data.get('role') == UserRoles.SUPER_ADMIN:
            if not request_user or not (request_user.role == UserRoles.SUPER_ADMIN or request_user.is_superuser):
                raise serializers.ValidationError({'role': 'Only SuperAdmins can create other SuperAdmin accounts.'})

        if data.get('password') != data.get('password_confirm'):
            raise serializers.ValidationError({'password': 'Passwords do not match.'})

        # Enforce max_users limit for the target college
        college = data.get('college')
        if college and hasattr(college, 'is_at_user_limit') and college.is_at_user_limit():
            raise serializers.ValidationError({
                'college': f'This college has reached its maximum user limit ({college.max_users}).'
            })

        return data

    def create(self, validated_data):
        validated_data.pop('password_confirm', None)
        password = validated_data.pop('password')
        role = validated_data.get('role', UserRoles.STUDENT)
        
        # Ensure username is uppercase
        validated_data['username'] = validated_data['username'].upper()
        
        # Enforce individual creation approval flow
        user = User.objects.create_user(
            password=password, 
            is_active=False,
            is_approved=False,
            **validated_data
        )
        
        # Assign group based on role
        group_map = {
            UserRoles.STUDENT: 'Student',
            UserRoles.STAFF: 'Staff',
            UserRoles.ADMIN: 'Admin',
            UserRoles.SUPER_ADMIN: 'Admin',
            UserRoles.PRINCIPAL: 'Principal',
            UserRoles.DIRECTOR: 'Director',
            UserRoles.HOD: 'HOD',
            UserRoles.WARDEN: 'Warden',
            UserRoles.HEAD_WARDEN: 'Head Warden',
            UserRoles.INCHARGE: 'Incharge',
            UserRoles.CHEF: 'Chef',
            UserRoles.HEAD_CHEF: 'Chef',
            UserRoles.GATE_SECURITY: 'Gate Security',
            UserRoles.SECURITY_HEAD: 'Security Head',
            UserRoles.PD: 'Sports',
            UserRoles.PT: 'Sports',
            UserRoles.ALUMNI: 'Alumni',
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
        
        # 1. Try authenticating by username first (Normalized)
        user = authenticate(username=normalized, password=password)
        
        # 2. Try authenticating by email if username failed or if the input looks like an email
        if not user and '@' in hall_ticket:
            user = authenticate(username=hall_ticket.lower(), password=password)
            if not user:
                # Some users might have mixed-case emails
                db_user = User.objects.filter(email__iexact=hall_ticket).first()
                if db_user:
                    user = authenticate(username=db_user.username, password=password)

        if not user:
            # 3. Try authenticating by registration_number (case-insensitive)
            try:
                db_user = User.objects.filter(registration_number__iexact=hall_ticket).first()
                if db_user:
                    user = authenticate(username=db_user.username, password=password)
            except Exception:
                pass

        if not user and normalized != hall_ticket:
            # 4. Back-compat for any legacy lowercase usernames in the DB.
            user = authenticate(username=hall_ticket, password=password)
        
        if not user:
            # Check if user exists but is inactive
            existing_user = User.objects.filter(
                Q(username__iexact=normalized) | 
                Q(username__iexact=hall_ticket) |
                Q(registration_number__iexact=hall_ticket)
            ).first()
            
            if existing_user:
                if not existing_user.is_active:
                    logger.warning(f"Login failed: User {existing_user.username} is INACTIVE.")
                    raise AuthenticationFailed('Account is inactive. Please contact your warden or administrator.')
                else:
                    logger.warning(f"Login failed: Invalid password for user {existing_user.username}.")
                    raise AuthenticationFailed('Incorrect password.')
            else:
                logger.warning(f"Login failed: User '{hall_ticket}' not found in DB.")
                raise AuthenticationFailed('User not found.')

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

        # ── 4-TIER ON/OFF CHECK ──
        # Super admins & management staff are generally exempt from building-level locks 
        # so they can still log in to fix issues. 
        is_management = user.role in TOP_LEVEL_ROLES
        if not user.is_superuser and not is_management:
            
            # Tier 1: College
            if user.college_id:
                college = user.college
                if college and not college.is_active:
                    raise AuthenticationFailed({
                        'detail': f"College Suspended: {college.disabled_reason or 'Access Restricted.'}",
                        'code': 'COLLEGE_DISABLED',
                        'college_name': college.name,
                    })

            # Tiers 2, 3, 4: Hostel, Block, Floor (Students only)
            if user.role == UserRoles.STUDENT:
                try:
                    from apps.rooms.models import RoomAllocation # type: ignore # pyre-ignore
                    allocation = (
                        RoomAllocation.objects
                        .filter(student=user, end_date__isnull=True, status='approved')
                        .select_related('room__building__hostel')
                        .only('room__floor', 
                              'room__building__id', 'room__building__is_active', 'room__building__disabled_reason', 'room__building__name', 'room__building__disabled_floors',
                              'room__building__hostel__id', 'room__building__hostel__is_active', 'room__building__hostel__disabled_reason', 'room__building__hostel__name')
                        .first()
                    )
                    
                    if allocation and allocation.room:
                        room = allocation.room
                        building = room.building
                        hostel = building.hostel if building else None

                        # Tier 2: Hostel
                        if hostel and not hostel.is_active:
                            raise AuthenticationFailed({
                                'detail': f"Hostel Suspended: {hostel.disabled_reason or 'Access Restricted.'}",
                                'code': 'HOSTEL_DISABLED',
                                'hostel_name': hostel.name,
                            })

                        # Tier 3: Block/Building (Synonymous with Block in this context)
                        if building and not building.is_active:
                            raise AuthenticationFailed({
                                'detail': f"Block Suspended: {building.disabled_reason or 'Access Restricted.'}",
                                'code': 'BLOCK_DISABLED',
                                'block_name': building.name,
                            })

                        # Tier 4: Floor
                        if building and room.floor in (building.disabled_floors or []):
                            raise AuthenticationFailed({
                                'detail': f"Floor {room.floor} Suspended: Access temporarily restricted.",
                                'code': 'FLOOR_DISABLED',
                                'floor_num': room.floor,
                                'block_name': building.name,
                            })
                except AuthenticationFailed:
                    raise
                except Exception:
                    pass

        data['user'] = user
        return data
