"""Views for authentication."""

import logging
import csv
import secrets

from rest_framework import viewsets, status, generics, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.views.decorators.cache import never_cache
from django.utils.decorators import method_decorator
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from rest_framework import serializers

from apps.auth.models import User
from apps.auth.serializers import (
    UserSerializer,
    UserDetailSerializer,
    UserCreateSerializer,
    AdminUserCreateSerializer,
    CustomTokenObtainPairSerializer,
    LoginSerializer,
)
from core.permissions import (
    IsAdmin, user_is_admin
)
from core.constants import UserRoles
from core.college_mixin import CollegeScopeMixin
from core.throttles import (
    ActionScopedThrottleMixin,
    LoginRateThrottle,
    BulkOperationThrottle,
    PasswordChangeThrottle,
    RoleChangeThrottle,
)

from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError

logger = logging.getLogger('django.request')


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token obtain view."""
    serializer_class = CustomTokenObtainPairSerializer


class LoginView(generics.GenericAPIView):
    """User login endpoint."""
    
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]
    
    def post(self, request, *args, **kwargs):
        """Handle login request."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']

        if user.is_superuser and user.role != UserRoles.SUPER_ADMIN:
            user.role = UserRoles.SUPER_ADMIN
            if not user.groups.filter(name='Admin').exists():
                admin_group, _ = Group.objects.get_or_create(name='Admin')
                user.groups.add(admin_group)
            user.save(update_fields=['role'])
        elif not user.role or user.role == UserRoles.STUDENT:
            if not user.groups.filter(name='Student').exists():
                group, _ = Group.objects.get_or_create(name='Student')
                user.groups.add(group)
            if user.role != UserRoles.STUDENT:
                user.role = UserRoles.STUDENT
                user.save(update_fields=['role'])
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        response = Response({
            'user': UserDetailSerializer(user).data,
            'tokens': {
                'access': access_token,
                'refresh': refresh_token,
            },
            'password_change_required': not user.is_password_changed
        }, status=status.HTTP_200_OK)

        # Security: Set HttpOnly cookies
        is_secure = not settings.DEBUG
        cookie_domain = settings.SIMPLE_JWT.get('AUTH_COOKIE_DOMAIN')
        
        access_lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME')
        access_max_age = int(access_lifetime.total_seconds()) if hasattr(access_lifetime, 'total_seconds') else 900
        
        # Access Token Cookie
        response.set_cookie(
            key=settings.SIMPLE_JWT['AUTH_COOKIE'],
            value=access_token,
            httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
            secure=is_secure,
            samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
            path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
            domain=cookie_domain,
            max_age=access_max_age
        )
        
        refresh_lifetime = settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME')
        refresh_max_age = int(refresh_lifetime.total_seconds()) if hasattr(refresh_lifetime, 'total_seconds') else 7 * 24 * 60 * 60
        
        # Refresh Token Cookie
        response.set_cookie(
            key=settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token'),
            value=refresh_token,
            httponly=True,
            secure=is_secure,
            samesite='Lax',
            path='/',
            domain=cookie_domain,
            max_age=refresh_max_age
        )
        
        return response


class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""
    
    serializer_class = UserCreateSerializer
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]  # Prevent massive automated registration requests
    queryset = User.objects.all()
    
    def create(self, request, *args, **kwargs):
        """Create a new user."""
        email = request.data.get('email', '')
        # Simple domain check to prevent obvious disposable emails or enforce institutional emails
        allowed_domains = getattr(settings, 'ALLOWED_EMAIL_DOMAINS', [])
        if allowed_domains:
            domain = email.split('@')[-1].lower() if '@' in email else ''
            if domain not in allowed_domains:
                return Response({'error': f"Only institutional emails are allowed: {', '.join(allowed_domains)}"}, status=status.HTTP_400_BAD_REQUEST)
                
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.save()
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        response = Response({
            'user': UserDetailSerializer(user).data,
        }, status=status.HTTP_201_CREATED)

        # Security: Set HttpOnly cookies
        is_secure = not settings.DEBUG
        cookie_domain = settings.SIMPLE_JWT.get('AUTH_COOKIE_DOMAIN')
        
        access_lifetime = settings.SIMPLE_JWT.get('ACCESS_TOKEN_LIFETIME')
        access_max_age = int(access_lifetime.total_seconds()) if hasattr(access_lifetime, 'total_seconds') else 900
        
        # Access Token Cookie
        response.set_cookie(
            key=settings.SIMPLE_JWT['AUTH_COOKIE'],
            value=access_token,
            httponly=settings.SIMPLE_JWT['AUTH_COOKIE_HTTP_ONLY'],
            secure=is_secure,
            samesite=settings.SIMPLE_JWT['AUTH_COOKIE_SAMESITE'],
            path=settings.SIMPLE_JWT['AUTH_COOKIE_PATH'],
            domain=cookie_domain,
            max_age=access_max_age
        )
        
        refresh_lifetime = settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME')
        refresh_max_age = int(refresh_lifetime.total_seconds()) if hasattr(refresh_lifetime, 'total_seconds') else 7 * 24 * 60 * 60
        
        # Refresh Token Cookie
        response.set_cookie(
            key=settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token'),
            value=refresh_token,
            httponly=True,
            secure=is_secure,
            samesite='Lax',
            path='/',
            domain=cookie_domain,
            max_age=refresh_max_age
        )
        
        return response


class SetupAdminSerializer(serializers.Serializer):
    setup_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    superadmin_password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=12)
    admin_password = serializers.CharField(write_only=True, trim_whitespace=False, min_length=12)

    def validate(self, attrs):
        if not getattr(settings, 'ENABLE_SETUP_ADMIN_ENDPOINT', False):
            raise PermissionDenied('Setup admin endpoint is disabled.')

        expected_token = getattr(settings, 'SETUP_ADMIN_TOKEN', '')
        if not expected_token:
            logger.error('Setup admin endpoint enabled without SETUP_ADMIN_TOKEN configured.')
            raise PermissionDenied('Setup admin endpoint is not configured.')

        request = self.context.get('request')
        provided_token = attrs.get('setup_token') or (request.headers.get('X-Setup-Token', '') if request else '')
        if not provided_token or not secrets.compare_digest(provided_token, expected_token):
            raise PermissionDenied('Invalid setup token.')

        if User.objects.filter(is_superuser=True).exists():
            raise PermissionDenied('Setup already completed. Admins exist.')

        return attrs

class SetupAdminView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]
    serializer_class = SetupAdminSerializer

    def get(self, request):
        return Response(
            {'detail': 'Use POST to initialize admin accounts when the endpoint is explicitly enabled.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        account_specs = [
            ('SUPERADMIN', UserRoles.SUPER_ADMIN, True, serializer.validated_data['superadmin_password']),
            ('ADMIN', UserRoles.ADMIN, False, serializer.validated_data['admin_password']),
        ]
        users = []

        for username, role, is_superuser, password in account_specs:
            user, created = User.objects.get_or_create(username=username)
            user.set_password(password)
            user.is_active = True
            user.is_staff = True
            user.role = role
            user.is_superuser = is_superuser
            user.email = f"{username.lower()}@hostelconnect.com"
            user.registration_number = username
            user.is_password_changed = True
            user.save()
            users.append({'username': username, 'role': role, 'created': created})

        return Response(
            {'success': True, 'message': 'Admin accounts are ready.', 'accounts': users},
            status=status.HTTP_200_OK,
        )

class RequestPasswordResetView(generics.GenericAPIView):
    """
    Request a password reset link.
    """
    permission_classes = [AllowAny]
    serializer_class = serializers.Serializer  # Required for drf-spectacular

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if user:
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Construct the reset link using configured FRONTEND_URL
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
            reset_link = f"{frontend_url}/reset-password/{uid}/{token}"
            
            # Send Email
            try:
                subject = "Reset your Hostel ERP Password"
                message = f"""
Hello {user.first_name or user.username},

You have requested to reset your password.
Please click the link below to set a new password:

{reset_link}

This link will expire in 15 minutes.
If you did not request this, please ignore this email.

Regards,
Hostel Management
"""
                send_mail(
                    subject,
                    message,
                    settings.DEFAULT_FROM_EMAIL,
                    [email],
                    fail_silently=False,
                )
            except Exception as e:
                logger.error(f"Failed to send password reset email: {e}")
            
            # Log reset link only in development
            if getattr(settings, 'DEBUG', False):
                # Always log link in debug for easy access without checking email console
                print(f"\n[DEBUG] PASSWORD RESET LINK for {email}: {reset_link}\n")
                logger.info(f"PASSWORD RESET LINK for {email}: {reset_link}")

        # Always return success to prevent email enumeration
        return Response(
            {'message': 'If an account exists with this email, a reset link has been sent.'},
            status=status.HTTP_200_OK
        )


class PasswordResetConfirmView(generics.GenericAPIView):
    """
    Confirm password reset using token and uid.
    """
    permission_classes = [AllowAny]
    serializer_class = serializers.Serializer

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('password')

        if not uidb64 or not token or not new_password:
            return Response({'error': 'Missing fields'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            user.set_password(new_password)
            user.is_password_changed = True
            user.save()
            return Response({'message': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Invalid token or user ID'}, status=status.HTTP_400_BAD_REQUEST)


class ProfileView(generics.RetrieveAPIView):
    """Get the authenticated user's profile."""

    serializer_class = UserDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class UserViewSet(ActionScopedThrottleMixin, CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for User management."""
    
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['role', 'is_active', 'college']
    action_throttle_scopes = {'list': 'user_list'}

    # Custom logic for top-level management to see across colleges is handled by Mixin

    def get_permissions(self):
        """Limit user-management operations by role hierarchy.
        
        - create/bulk_upload/destroy: authenticated (role checks inside handlers).
        - Everything else: authenticated.
        """
        permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """
        Limit user visibility for privacy:
        - Students can list active non-student roles.
        - Staff/wardens/admins can see all users (including inactive ones for management).
        - Broad scoping (College/Tenant) is handled automatically by CollegeScopeMixin.
        """
        user = self.request.user
        # Base Queryset with optimizations
        qs = super().get_queryset().select_related('college').prefetch_related('groups')
        
        if getattr(user, 'role', None) == UserRoles.STUDENT:
            # Students can only see themselves + staff/warden roles for messaging
            # They CANNOT search or list other students (visitor module security)
            return qs.filter(is_active=True).filter(
                Q(id=user.id) | Q(role__in=[
                    UserRoles.WARDEN,
                    UserRoles.HEAD_WARDEN,
                    UserRoles.ADMIN,
                    UserRoles.SUPER_ADMIN,
                    UserRoles.STAFF,
                    UserRoles.HR,
                ])
            )

        # CollegeScopeMixin handles the college_id filtering for management roles automatically.
        # It also handles the SuperAdmin bypass.
        
        # Extension for Room Mapping: Filter students who don't have an active room allocation
        unassigned_only = self.request.query_params.get('unassigned') == 'true'
        if unassigned_only:
            qs = qs.filter(role=UserRoles.STUDENT).filter(
                Q(room_allocations__isnull=True) | 
                Q(room_allocations__end_date__isnull=False)
            ).distinct()

        return qs

    def get_object(self):
        """
        Enforce strict hierarchy for user-management:
        - SuperAdmins: Can manage everyone.
        - Admins: Can manage Wardens, Staff, and Students. CANNOT manage other Admins or SuperAdmins.
        - Owners: Can read/update their own profile.
        """
        obj = super().get_object()
        user = self.request.user
        
        # 1. Base check: Non-admins can only see/edit themselves
        # Special Rules for Department Heads
        is_admin = user_is_admin(user)

        if not is_admin and obj.id != user.id:
            authorized = False
            
            # Head Warden manages wardens + students
            if user.role == UserRoles.HEAD_WARDEN and obj.role in [UserRoles.WARDEN, UserRoles.STUDENT]:
                authorized = True
            # Wardens manage students
            elif user.role == UserRoles.WARDEN and obj.role == UserRoles.STUDENT:
                authorized = True
            # Head Chef manages Chefs
            elif user.role == UserRoles.HEAD_CHEF and obj.role == UserRoles.CHEF:
                authorized = True
            # Security Head manages Gate Security
            elif user.role == UserRoles.SECURITY_HEAD and obj.role == UserRoles.GATE_SECURITY:
                authorized = True
                
            if not authorized:
                raise PermissionDenied('Not authorized. You can only manage users within your specific department/authority.')

        # 2. Hierarchy Check (Modifying/Deleting others)
        if self.action in ['update', 'partial_update', 'destroy', 'admin_reset_password', 'toggle_active'] and obj.id != user.id:
            user_weight = 101 if user.is_superuser else UserRoles.get_weight(user.role)
            target_weight = UserRoles.get_weight(obj.role)

            # Rule: One can ONLY manage someone strictly LOWER in the hierarchy
            if user_weight <= target_weight:
                raise PermissionDenied(f"Insufficient rank. You can only manage roles strictly lower than yours. (Your weight: {user_weight}, Target: {target_weight})")

        # Scope override toggle is restricted to Admins and Head Wardens (wardens only).
        if self.action in ['update', 'partial_update'] and 'can_access_all_blocks' in self.request.data and obj.id != user.id:
            can_toggle_scope = user_is_admin(user) or (user.role == UserRoles.HEAD_WARDEN and obj.role == UserRoles.WARDEN)
            if not can_toggle_scope:
                raise PermissionDenied('You are not allowed to change cross-block scope overrides.')

        # 3. CORE PERSONAL INFO RESTRICTION
        # Even if you have authority (e.g. Warden over Student), only Admins can touch CORE fields
        if self.action in ['update', 'partial_update'] and obj.id != user.id:
            if not is_admin:
                CORE_RESTRICTED_FIELDS = ['first_name', 'last_name', 'email', 'phone_number', 'registration_number', 'username']
                # Check if any restricted fields are being sent in the update
                attempted_fields = [k for k in self.request.data.keys() if k in CORE_RESTRICTED_FIELDS]
                if attempted_fields:
                    raise PermissionDenied(f'You do not have permission to edit core personal details ({", ".join(attempted_fields)}). Contact an Administrator.')

        return obj
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            # Safe check allowing for unauthenticated access (though get_permissions might block)
            request_user = getattr(self.request, 'user', None)
            if request_user and getattr(request_user, 'is_authenticated', False):
                if user_is_admin(request_user) or getattr(request_user, 'is_superuser', False) or request_user.role in [UserRoles.HEAD_WARDEN, UserRoles.HEAD_CHEF, UserRoles.SECURITY_HEAD]:
                    return AdminUserCreateSerializer
            # Wardens get the student-only serializer
            return UserCreateSerializer
        elif self.action == 'retrieve':
            return UserDetailSerializer
        return UserSerializer

    def _can_manage_role_for_domain_actor(self, actor_role, target_role):
        role_map = {
            UserRoles.HEAD_WARDEN: {UserRoles.STUDENT, UserRoles.WARDEN},
            UserRoles.WARDEN: {UserRoles.STUDENT},
            UserRoles.HEAD_CHEF: {UserRoles.CHEF},
            UserRoles.SECURITY_HEAD: {UserRoles.GATE_SECURITY},
        }
        return target_role in role_map.get(actor_role, set())

    def _enforce_domain_role_management(self, actor, target_role, *, action_label):
        if user_is_admin(actor):
            return
        if self._can_manage_role_for_domain_actor(actor.role, target_role):
            return
        raise PermissionDenied(
            f'You do not have authority to {action_label} this role. '
            'Only Admins can manage all roles, or you must be the specific Head of that department.'
        )

    def create(self, request, *args, **kwargs):
        """Override create to enforce role-based restrictions.
        
        - Admins/SuperAdmins: can create any role.
        - Head Wardens: can create wardens + students.
        - Wardens: can create students.
        - Head Chef: can create chefs.
        - Security Head: can create gate security.
        - Everyone else: denied (handled by get_permissions).
        """
        user = request.user
        requested_role = request.data.get('role', UserRoles.STUDENT)

        self._enforce_domain_role_management(user, requested_role, action_label='create')

        # 2. College Isolation Check:
        is_global_owner = getattr(user, 'is_superuser', False) or user.role == UserRoles.SUPER_ADMIN
        if not is_global_owner and user.college_id:
            # If creating a Student via UserCreateSerializer, college is handled by college_code
            # If creating via AdminUserCreateSerializer, college is handled by PK
            
            # For Warden creating student: they use UserCreateSerializer which uses college_code
            if requested_role == UserRoles.STUDENT:
                requested_code = request.data.get('college_code')
                if requested_code and requested_code != getattr(user.college, 'code', None):
                    raise PermissionDenied("You can only create students for your assigned college.")
                # We can enforce it by setting it in request.data if missing
                if not requested_code:
                    request.data['college_code'] = getattr(user.college, 'code', None)
            else:
                # For other roles (e.g. Head Chef creating Chef)
                requested_college_id = request.data.get('college')
                if requested_college_id and str(requested_college_id) != str(user.college_id):
                    raise PermissionDenied("You can only create users for your assigned college.")
                if not requested_college_id:
                    request.data['college'] = user.college_id

        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Override destroy to enforce role-based deletion restrictions.
        
        - Admins/SuperAdmins: can delete any user (hierarchy still applies via get_object).
        - Head Wardens: can delete wardens + students.
        - Wardens: can only delete students.
        - Head Chef: can delete chefs.
        - Security Head: can delete gate security.
        - Everyone else: denied (handled by get_permissions).
        """
        obj = self.get_object()
        user = request.user

        self._enforce_domain_role_management(user, obj.role, action_label='delete')

        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'], throttle_classes=[RoleChangeThrottle])
    def toggle_active(self, request, pk=None):
        """Toggle a user's is_active status (activate/deactivate)."""
        obj = self.get_object()  # Applies all our strict hierarchy rules
        old_status = obj.is_active
        obj.is_active = not obj.is_active
        obj.save()
        status_text = "activated" if obj.is_active else "deactivated"
        
        # Audit log: activation/deactivation is a critical action
        from core.audit import log_action
        log_action(request.user, 'UPDATE', obj, changes={
            'is_active': [old_status, obj.is_active],
            'action': status_text,
        }, request=request)
        
        return Response({'detail': f'User {obj.username} successfully {status_text}.', 'is_active': obj.is_active})
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user details."""
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['put'], throttle_classes=[PasswordChangeThrottle])
    def change_password(self, request):
        """Change user password."""
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        new_password_confirm = request.data.get('new_password_confirm')
        
        if not old_password or not new_password:
            return Response({
                'detail': 'Both old and new passwords are required.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not user.check_password(old_password):
            return Response({
                'detail': 'Old password is incorrect.',
                'code': 'INVALID_PASSWORD'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if new_password != new_password_confirm:
            return Response({
                'detail': 'New passwords do not match.',
                'code': 'PASSWORD_MISMATCH'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(new_password)
        user.is_password_changed = True
        user.save()
        
        return Response({
            'detail': 'Password changed successfully.'
        }, status=status.HTTP_200_OK)
        
    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def admin_reset_password(self, request, pk=None):
        """
        Admin forces password reset for a user.
        User must change it on next login.
        """
        user = self.get_object()
        new_password = request.data.get('new_password')
        
        if not new_password:
            # Auto-generate if not provided
            new_password = User.objects.make_random_password()
            
        user.set_password(new_password)
        user.is_password_changed = False # Force change on next login
        user.save()
        
        return Response({
            'detail': f'Password reset successfully for {user.username}.',
            'temporary_password': new_password
        })

    @action(detail=False, methods=['post'], parser_classes=[parsers.MultiPartParser, parsers.FormParser])
    def update_profile_picture(self, request):
        """Update current user's profile picture with optimization."""
        user = request.user
        photo = request.FILES.get('profile_picture')
        
        if not photo:
            return Response({'detail': 'No photo provided.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # 1. Validation (5MB limit)
        if photo.size > 5 * 1024 * 1024:
            return Response({'detail': 'Image must be smaller than 5MB.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Supported formats validation
        allowed_types = ['image/jpeg', 'image/png', 'image/jpg']
        file_mime = getattr(photo, 'content_type', '')
        if file_mime not in allowed_types:
            return Response({'detail': 'Unsupported format. Please upload JPG, JPEG, or PNG.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # 2. Optimization Phase
        from PIL import Image
        import io
        import os
        from django.core.files.base import ContentFile
        
        try:
            # Open the image using Pillow
            img = Image.open(photo)
            
            # Auto-rotate based on EXIF data if present (common in mobile uploads)
            try:
                from PIL import ImageOps
                img = ImageOps.exif_transpose(img)
            except Exception:
                pass

            # Convert to RGB if necessary (e.g., PNG with alpha to WebP/JPEG)
            if img.mode in ("RGBA", "P"):
                # Create a white background for transparent images
                background = Image.new("RGB", img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[3] if img.mode == "RGBA" else None)
                img = background
            elif img.mode != "RGB":
                img = img.convert("RGB")
            
            # Resize: Max 512x512 while maintaining aspect ratio
            img.thumbnail((512, 512), Image.Resampling.LANCZOS)
            
            # Save to buffer as WebP with 80% quality
            output = io.BytesIO()
            img.save(output, format='WEBP', quality=80, method=6) # method 6 = best compression
            output.seek(0)
            
            # File naming: studentID_profile_TIMESTAMP.webp (timestamp ensures refresh on upload)
            import time
            timestamp = int(time.time())
            ident = user.registration_number or user.username
            file_name = f"{ident}_profile_{timestamp}.webp"
            
            # Clean up old profile picture if it exists to save space (institutional requirement)
            if user.profile_picture:
                try:
                    storage = user.profile_picture.storage
                    if storage.exists(user.profile_picture.name):
                        storage.delete(user.profile_picture.name)
                except Exception as e:
                    logger.warning(f"Failed to delete old profile picture: {e}")

            # Update user with the optimized WebP image
            user.profile_picture.save(file_name, ContentFile(output.read()), save=True)
            
            response = Response({
                'detail': 'Profile picture updated successfully.',
                'profile_picture': request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None
            })
            
            # Cache optimization: Set Cache-Control for 1 year (institutional grade caching)
            # This relies on the file URL change which save() handles via suffix if needed, 
            # but since we delete old ones, we should use a timestamp or unique hash if possible.
            # For now, standard browser cache hint.
            response["Cache-Control"] = "public, max-age=31536000, immutable"
            return response

        except Exception as e:
            logger.error(f"Error optimizing profile picture for user {user.username}: {e}")
            return Response({'detail': f'Error processing image: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'], throttle_classes=[BulkOperationThrottle])
    def bulk_upload(self, request):
        """
        Bulk create users from a CSV file.
        Robust version: Validates headers, headers flexible, checks duplicates, batches processing.
        """
        import io
        from django.db import transaction
        from apps.users.models import Tenant
        
        user = request.user
        if not user_is_admin(user):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'detail': 'CSV file is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Handle BOM and encoding
            decoded_file = file_obj.read().decode('utf-8-sig')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)

            # Flexible header mapping
            field_map = {
                'registration_number': ['reg_no', 'hall_ticket', 'username', 'roll_no', 'ht no', 'student hall ticket'],
                'first_name': ['name', 'student_name'],
                'mobile': ['phone_number', 'phone', 'student_mobile', 'stu mobile', 'student mobile'],
                'email': ['student_email'],
                'father_name': ['parent_name', 'f_name', 'parent name', 'father name'],
                'father_phone': ['parent_phone', 'f_mobile', 'parent phone', 'father phone'],
                'mother_name': ['m_name', 'mother name', 'mother_name'],
                'mother_phone': ['m_mobile', 'mother phone', 'mother_phone'],
                'guardian_name': ['guardian_name', 'g_name', 'guardian name'],
                'guardian_phone': ['guardian_phone', 'g_mobile', 'guardian phone'],
                'college_code': ['college', 'college code']
            }
            
            rows = list(reader)
            if not rows:
                return Response({'detail': 'Empty CSV file.'}, status=status.HTTP_400_BAD_REQUEST)

            created_count = 0
            errors = []
            generated_passwords = []
            valid_rows = []
            
            seen_reg_nos = set()

            # 1. Validation Phase (In-Memory)
            for idx, row in enumerate(rows, start=2):
                normalized = {k.strip().lower(): (v.strip() if v else '') for k, v in row.items() if k}
                
                def get_val(key):
                    if key in normalized: return normalized[key]
                    for alias in field_map.get(key, []):
                         if alias in normalized: return normalized[alias]
                    return ''

                reg_no = get_val('registration_number').upper()
                if not reg_no:
                    errors.append({'row': idx, 'error': 'Missing Hall Ticket/Username'})
                    continue
                
                if reg_no in seen_reg_nos:
                    errors.append({'row': idx, 'error': f'Duplicate in file: {reg_no}'})
                    continue
                seen_reg_nos.add(reg_no)

                first_name = get_val('first_name')
                last_name = row.get('last_name', '')
                if not first_name:
                    # Fallback: try splitting last_name if it looks like full name
                    if last_name:
                        names = last_name.split(' ', 1)
                        first_name = names[0]
                        if len(names) > 1: last_name = names[1]
                    else:
                        errors.append({'row': idx, 'error': 'Missing Name'})
                        continue
                
                # Mandatory details
                phone = get_val('mobile')
                email = get_val('email')
                if not email:
                    errors.append({'row': idx, 'error': 'Missing Email Address (Required for password reset)'})
                    continue
                # Password logic: if provided use it, else generate
                password = row.get('password', '')
                is_generated = False
                if not password:
                    password = User.objects.make_random_password()
                    is_generated = True

                valid_rows.append({
                    'reg_no': reg_no,
                    'first_name': first_name,
                    'last_name': last_name,
                    'phone': phone,
                    'email': email,
                    'password': password,
                    'is_generated': is_generated,
                    'father_name': get_val('father_name'),
                    'father_phone': get_val('father_phone'),
                    'mother_name': get_val('mother_name'),
                    'mother_phone': get_val('mother_phone'),
                    'guardian_name': get_val('guardian_name'),
                    'guardian_phone': get_val('guardian_phone'),
                    'address': normalized.get('address', ''),
                    'city': normalized.get('city', ''),
                    'state': normalized.get('state', ''),
                    'pincode': normalized.get('pincode', ''),
                    'college_code': get_val('college_code'),
                    'line_no': idx
                })

            # 2. Database Phase (Fast Bulk Create)
            if valid_rows:
                # Pre-fetch existing users to avoid errors
                existing_usernames = set(User.objects.filter(username__in=[r['reg_no'] for r in valid_rows]).values_list('username', flat=True))
                existing_emails = set(User.objects.filter(email__in=[r['email'] for r in valid_rows if r['email']]).values_list('email', flat=True))
                
                to_process = []
                for r in valid_rows:
                    if r['reg_no'] in existing_usernames:
                         errors.append({'row': r['line_no'], 'error': f'User {r["reg_no"]} already exists in database'})
                    elif r['email'] and r['email'].lower() in {e.lower() for e in existing_emails}:
                         errors.append({'row': r['line_no'], 'error': f'Email {r["email"]} already exists in database'})
                    else:
                         to_process.append(r)
                
                users_to_create = []
                tenants_to_create = []
                from django.contrib.auth.hashers import make_password
                from apps.colleges.models import College
                
                college_codes = set(item['college_code'] for item in to_process if item['college_code'])
                college_map = {c.code.lower(): c for c in College.objects.filter(code__in=college_codes)}
                
                valid_items_to_process = []
                
                for item in to_process:
                    college_instance = None
                    if item['college_code']:
                        college_instance = college_map.get(item['college_code'].lower())
                        if not college_instance:
                            errors.append({'row': item['line_no'], 'error': f'Invalid college code: {item["college_code"]}'})
                            continue
                            
                    user = User(
                        username=item['reg_no'],
                        registration_number=item['reg_no'],
                        first_name=item['first_name'],
                        last_name=item['last_name'],
                        email=item['email'],
                        phone_number=item['phone'],
                        password=make_password(item['password']),
                        role=UserRoles.STUDENT,
                        is_active=True,
                        is_password_changed=True,
                        college=college_instance,
                    )
                    users_to_create.append(user)
                    valid_items_to_process.append(item)
                    
                if users_to_create:
                    # Individual Processing for resilience (as per Audit workflow)
                    # This ensures that one bad row doesn't roll back the entire batch.
                    student_group, _ = Group.objects.get_or_create(name='Student')
                    
                    for idx, user_obj in enumerate(users_to_create):
                        item = valid_items_to_process[idx]
                        try:
                            with transaction.atomic():
                                user_obj.save()
                                user_obj.groups.add(student_group)
                                
                                Tenant.objects.create(
                                    user=user_obj,
                                    father_name=item['father_name'],
                                    father_phone=item['father_phone'],
                                    mother_name=item['mother_name'],
                                    mother_phone=item['mother_phone'],
                                    guardian_name=item['guardian_name'],
                                    guardian_phone=item['guardian_phone'],
                                    address=item['address'],
                                    city=item['city'],
                                    state=item['state'],
                                    pincode=item['pincode'],
                                    college_code=item['college_code'] or None
                                )
                                
                                created_count += 1
                                if item['is_generated']:
                                    generated_passwords.append({
                                        'username': item['reg_no'], 
                                        'password': item['password']
                                    })
                        except Exception as exc:
                            errors.append({
                                'row': item['line_no'], 
                                'error': str(exc),
                                'username': item['reg_no']
                            })

        except Exception as e:
            return Response({'detail': f'Bulk upload failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'created': created_count,
            'errors': errors,
            'generated_passwords': generated_passwords,
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        """Download a sample CSV template for student upload."""
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="student_upload_template.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'registration_number', 'first_name', 'last_name', 'phone_number', 
            'email', 'father_name', 'father_phone', 'mother_name', 'mother_phone', 
            'address', 'city', 'state', 'pincode', 'college_code'
        ])
        writer.writerow([
            'REG12345', 'John', 'Doe', '9876543210', 
            'john@example.com', 'Mr. Doe', '9876543211', 'Mrs. Doe', '9876543212', 
            '123 Street', 'Hyderabad', 'Telangana', '500001', 'ENG101'
        ])
        return response

class RequestOTPView(generics.GenericAPIView):
    """
    Request OTP for password reset (Email-based Flow - FREE).
    Sends OTP to user's registered email address.
    """
    permission_classes = [AllowAny]
    throttle_classes = [PasswordChangeThrottle, AnonRateThrottle] 
    serializer_class = serializers.Serializer

    @staticmethod
    def _mask_email(email: str) -> str:
        if '@' not in email:
            return email
        local_part, domain = email.split('@', 1)
        if len(local_part) <= 2:
            masked_local = f"{local_part[0]}*" if local_part else '*'
        else:
            masked_local = f"{local_part[:2]}{'*' * max(len(local_part) - 2, 1)}"
        return f"{masked_local}@{domain}"

    def post(self, request):
        hall_ticket = request.data.get('hall_ticket')
        if not hall_ticket:
             return Response({'error': 'Hall ticket/Username is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        hall_ticket = hall_ticket.strip().upper()
        
        # Redis attempt counter protection per IP and Username
        from django.core.cache import cache
        from core.cache_keys import otp_request_attempts, otp_password_reset
        import random
        import hashlib
        
        client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', 'unknown_ip')).split(',')[0].strip()
        attempt_key = otp_request_attempts(hall_ticket, client_ip)
        
        attempts = cache.get(attempt_key, 0)
        if attempts >= 5:
             logger.warning(f"OTP brute force prevented for {hall_ticket} from {client_ip}")
             return Response({'error': 'Too many OTP requests. Please try again after 10 minutes.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
             
        cache.set(attempt_key, attempts + 1, 60 * 10)  # 10 minutes lockout
        
        # Case insensitive lookup by username first, then registration number.
        user = User.objects.filter(username__iexact=hall_ticket).first()
        if not user:
            user = User.objects.filter(registration_number__iexact=hall_ticket).first()
        response_data = {'message': 'If account exists, OTP has been sent to registered email.'}

        if user:
             # Generate 6 digit OTP
             otp = f"{random.randint(100000, 999999)}"
             
             # Store hash in Redis using structured namespaced key
             # TTL: 15 minutes
             cache_key = otp_password_reset(user.id)
             otp_hash = hashlib.sha256(otp.encode()).hexdigest()
             cache.set(cache_key, otp_hash, 60*15) 
             
             # Send OTP via Email (Completely FREE)
             if user.email:
                 try:
                     self._send_otp_email(user.email, otp, user.first_name or user.username)
                     response_data['delivery'] = 'email'
                     response_data['email_hint'] = self._mask_email(user.email)
                     response_data['message'] = f"OTP sent to {response_data['email_hint']}."
                 except Exception as e:
                     logger.error(f"Failed to send OTP email: {str(e)}")
                     if getattr(settings, 'DEBUG', False):
                         response_data['delivery'] = 'debug'
                         response_data['debug_otp'] = otp
                         response_data['message'] = 'Email delivery failed locally. Use the debug OTP below to reset the password.'
             else:
                 logger.warning(f"User {user.username} has no email. OTP cannot be sent.")
                 if getattr(settings, 'DEBUG', False):
                     print(f"\n[WARNING] User {user.username} has no email. OTP will only be visible here in console.\n")
                     response_data['delivery'] = 'debug'
                     response_data['debug_otp'] = otp
                     response_data['message'] = 'No email is configured for this account locally. Use the debug OTP below to reset the password.'
             
             # Development fallback / Always log in DEBUG
             if getattr(settings, 'DEBUG', False):
                 print(f"\n[DEBUG] PASSWORD RESET OTP for {user.username}: {otp}\n")
                 logger.info(f"PASSWORD RESET OTP for {user.username}: {otp}")
             
        # Security: Always return success (prevent username enumeration)
        return Response(response_data, status=status.HTTP_200_OK)
    
    def _send_otp_email(self, email, otp, name):
        """Send OTP via Email (Free)"""
        from django.core.mail import send_mail
        from django.conf import settings
        
        subject = "CampusCore - Password Reset OTP"
        
        message = f"""
Hello {name},

Your CampusCore password reset OTP is: {otp}

⏱️ This OTP is valid for 15 minutes only.
🔒 Do not share this OTP with anyone.

If you didn't request this, please ignore this email.

---
CampusCore - Hostel Management System
"""
        
        html_message = f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                <div style="background-color: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #FF7444; margin: 0;">CampusCore</h2>
                        <p style="color: #999; margin: 5px 0 0 0;">Hostel Management System</p>
                    </div>
                    
                    <h3 style="color: #333; margin-bottom: 15px;">Password Reset OTP</h3>
                    
                    <p style="color: #666; margin-bottom: 20px;">Hello <strong>{name}</strong>,</p>
                    
                    <p style="color: #666; margin-bottom: 20px;">Your password reset OTP is:</p>
                    
                    <div style="background-color: #FFF3F0; border: 2px solid #FF7444; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
                        <h1 style="color: #FF7444; letter-spacing: 5px; margin: 0; font-size: 32px; font-family: 'Courier New', monospace;">{otp}</h1>
                    </div>
                    
                    <div style="background-color: #FFF8F5; border-left: 4px solid #FF7444; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                        <p style="color: #666; margin: 0; font-size: 14px;">
                            <strong>⏱️ Valid for 15 minutes only</strong><br>
                            <strong>🔒 Never share this OTP with anyone</strong>
                        </p>
                    </div>
                    
                    <p style="color: #999; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                        If you didn't request this password reset, please ignore this email.<br>
                        © 2026 CampusCore. All rights reserved.
                    </p>
                </div>
            </body>
        </html>
        """
        
        try:
            send_mail(
                subject,
                message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                html_message=html_message,
                fail_silently=False,
            )
            logger.info(f"OTP email sent successfully to {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send OTP email to {email}: {str(e)}")
            raise


class VerifyOTPAndResetView(generics.GenericAPIView):
    """
    Verify OTP and reset password.
    """
    permission_classes = [AllowAny]
    throttle_classes = [PasswordChangeThrottle, AnonRateThrottle]
    serializer_class = serializers.Serializer

    def post(self, request):
        hall_ticket = request.data.get('hall_ticket')
        otp = request.data.get('otp')
        new_password = request.data.get('new_password')
        
        if not hall_ticket or not otp or not new_password:
             return Response({'error': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)
             
        hall_ticket = hall_ticket.strip().upper()
        
        from django.core.cache import cache
        from core.cache_keys import otp_verify_attempts, otp_password_reset, otp_request_attempts
        import hashlib
        
        client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', 'unknown_ip')).split(',')[0].strip()
        verify_attempt_key = otp_verify_attempts(hall_ticket, client_ip)
        
        attempts = cache.get(verify_attempt_key, 0)
        if attempts >= 5:
             logger.warning(f"OTP verification brute force prevented for {hall_ticket} from {client_ip}")
             return Response({'error': 'Too many failed verification attempts. Try again later.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
             
        user = User.objects.filter(username__iexact=hall_ticket).first()
        if not user:
             user = User.objects.filter(registration_number__iexact=hall_ticket).first()
        
        if not user:
             return Response({'error': 'Invalid OTP or expired.'}, status=status.HTTP_400_BAD_REQUEST)
        
        cache_key = otp_password_reset(user.id)
        cached_hash = cache.get(cache_key)
        
        input_hash = hashlib.sha256(otp.encode()).hexdigest()
        
        if not cached_hash:
             logger.warning(f"OTP verification failed for {user.username}: No OTP found in cache.")
             return Response({'error': 'OTP expired or not requested.'}, status=status.HTTP_400_BAD_REQUEST)

        if cached_hash != input_hash:
             logger.warning(f"OTP verification failed for {user.username}: Hash mismatch.")
             cache.set(verify_attempt_key, attempts + 1, 60 * 15)  # 15 mins block on failed verify
             return Response({'error': 'Invalid OTP.'}, status=status.HTTP_400_BAD_REQUEST)
             
        # Success
        try:
            validate_password(new_password, user)
        except DjangoValidationError as exc:
            return Response({'error': list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.is_password_changed = True
        user.is_active = True # Unblock if needed
        user.save()
        
        # Invalidate OTP and attempts using structured key helpers
        cache.delete(cache_key)
        cache.delete(verify_attempt_key)
        cache.delete(otp_request_attempts(hall_ticket, client_ip))
        
        return Response({'message': 'Password has been reset successfully. Please login.'}, status=status.HTTP_200_OK)


class LogoutView(generics.GenericAPIView):
    """
    Logout endpoint - blacklists the refresh token and clears the cookie.
    Accepts refresh token from either request body or httpOnly cookie.
    """
    permission_classes = [AllowAny]
    serializer_class = serializers.Serializer

    def post(self, request):
        # Determine the refresh token source
        refresh_token = request.data.get('refresh') or request.COOKIES.get(
            settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')
        )

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass  # Ignore errors during blacklisting; user must be logged out locally anyway

        # Clean sweep: clear the cookies and return success
        response = Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)
        
        # Clear cookies with matching domain
        cookie_domain = settings.SIMPLE_JWT.get('AUTH_COOKIE_DOMAIN')
        response.delete_cookie(settings.SIMPLE_JWT['AUTH_COOKIE'], path='/', domain=cookie_domain)
        response.delete_cookie(settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token'), path='/', domain=cookie_domain)
        
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """
    Refresh access token from httpOnly refresh cookie and set new token back in cookie.
    This completes the secure, stateless cookie authentication lifecycle.
    """
    def post(self, request, *args, **kwargs):
        # 1. Grab raw refresh token from cookie
        refresh_token = request.COOKIES.get(
            settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token')
        )
        
        if not refresh_token:
            return Response({'detail': 'Refresh token missing.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        try:
            # 2. Generate new tokens using the standard serializer
            serializer = self.get_serializer(data={'refresh': refresh_token})
            serializer.is_valid(raise_exception=True)
            new_data = serializer.validated_data
            
            # 3. Handle response - move tokens to cookies AND return in body for frontend store sync
            response = Response({
                'detail': 'Token refreshed.',
                'access': new_data['access'],
                'refresh': new_data.get('refresh') # Include if rotated
            }, status=status.HTTP_200_OK)
            
            is_secure = not settings.DEBUG
            cookie_domain = settings.SIMPLE_JWT.get('AUTH_COOKIE_DOMAIN')
            
            # Update Access Token Cookie
            response.set_cookie(
                key=settings.SIMPLE_JWT['AUTH_COOKIE'],
                value=new_data['access'],
                httponly=True,
                secure=is_secure,
                samesite='Lax',
                path='/',
                domain=cookie_domain,
                max_age=900  # 15 min (matches ACCESS_TOKEN_LIFETIME)
            )
            
            # Update Refresh Token Cookie (if rotated)
            if 'refresh' in new_data:
                response.set_cookie(
                    key=settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token'),
                    value=new_data['refresh'],
                    httponly=True,
                    secure=is_secure,
                    samesite='Lax',
                    path='/',
                    domain=cookie_domain,
                    max_age=7 * 24 * 60 * 60
                )
                
            return response
            
        except TokenError as e:
            # Common case after logout/rotation: remove stale refresh cookie immediately.
            logger.warning(f"Cookie token refresh rejected: {str(e)}")
            response = Response({'detail': 'Invalid refresh token.'}, status=status.HTTP_401_UNAUTHORIZED)
            cookie_domain = settings.SIMPLE_JWT.get('AUTH_COOKIE_DOMAIN')
            response.delete_cookie(
                settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'refresh_token'),
                path='/',
                domain=cookie_domain,
            )
            response.delete_cookie(
                settings.SIMPLE_JWT['AUTH_COOKIE'],
                path='/',
                domain=cookie_domain,
            )
            return response
        except Exception as e:
            logger.error(f"Cookie token refresh failed: {str(e)}")
            return Response({'detail': 'Token refresh failed.'}, status=status.HTTP_401_UNAUTHORIZED)


class SPAView(generics.GenericAPIView):
    """
    Catch-all view to support Single Page Application (SPA) routing.
    Redirects direct navigations and refreshes to the main frontend layout.
    """
    permission_classes = [AllowAny]
    throttle_classes = []  # Explicitly disable throttling for SPA entry point
    serializer_class = serializers.Serializer

    
    @method_decorator(never_cache)
    def get(self, request, *args, **kwargs):
        # We serve the dashboard template when a direct URL is accessed.
        # This template is expected to include the built React application scripts.
        from django.shortcuts import render
        return render(request, 'web/dashboard.html')


class MyPermissionsView(generics.GenericAPIView):
    """Return the current user's module capabilities and allowed frontend paths.

    Response shape::

        {
          "role": "warden",
                    "role_governance": {
                        "scope": "building_or_floor",
                        "label": "Warden",
                        "description": "Operational control for assigned blocks/floors under head-warden governance."
                    },
          "modules": {
            "gatepass": { "level": "approve", "capabilities": ["view", "approve"] },
            ...
          },
          "allowed_paths": ["/dashboard", "/gate-passes", ...]
        }

    The ``allowed_paths`` list is the authoritative source for the frontend
    sidebar and route guard.  It is cached on the backend (15 min) and the
    frontend adds its own stale-time (5 min) on top.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = serializers.Serializer

    @method_decorator(never_cache)
    def get(self, request, *args, **kwargs):
        from core.rbac import (
            LEVEL_CAPABILITIES,
            get_path_grants_for_user,
            get_role_governance_profile,
            get_user_module_levels,
        )

        user = request.user
        module_levels = get_user_module_levels(user)

        modules_payload: dict = {}
        for module_slug, level in module_levels.items():
            capabilities = sorted(LEVEL_CAPABILITIES.get(level, set()))
            modules_payload[module_slug] = {
                'level': level,
                'capabilities': capabilities,
            }

        allowed_paths = get_path_grants_for_user(user, module_levels)
        role_governance = get_role_governance_profile(user)

        return Response(
            {
                'role': user.role,
                'role_governance': role_governance,
                'modules': modules_payload,
                'allowed_paths': allowed_paths,
            },
            status=status.HTTP_200_OK,
        )
