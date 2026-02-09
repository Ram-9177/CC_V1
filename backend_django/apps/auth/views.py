"""Views for authentication."""

import csv
from io import TextIOWrapper

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import Group
from django.db.models import Q

from apps.auth.models import User
from apps.auth.serializers import (
    UserSerializer,
    UserDetailSerializer,
    UserCreateSerializer,
    AdminUserCreateSerializer,
    CustomTokenObtainPairSerializer,
    LoginSerializer,
)
from core.permissions import IsAdmin, user_is_admin
from core.throttles import LoginRateThrottle, ExportRateThrottle, BulkOperationThrottle
from rest_framework.exceptions import PermissionDenied


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

        if not user.role or user.role == 'student':
            if not user.groups.filter(name='Student').exists():
                group, _ = Group.objects.get_or_create(name='Student')
                user.groups.add(group)
                user.role = 'student'
                user.save(update_fields=['role'])
        elif user.is_superuser and user.role != 'super_admin':
            user.role = 'super_admin'
            user.save(update_fields=['role'])
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        response = Response({
            'user': UserDetailSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)

        # Security: Set refresh token in HttpOnly cookie
        from django.conf import settings
        response.set_cookie(
            key='refresh_token',
            value=str(refresh),
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax',
            path='/',  # Ideally /api/auth/token/refresh/ but broad path is safer for now
            max_age=24 * 60 * 60  # 1 day
        )
        
        return response


class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""
    
    serializer_class = UserCreateSerializer
    permission_classes = [AllowAny]
    queryset = User.objects.all()
    
    def create(self, request, *args, **kwargs):
        """Create a new user."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.save()
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        response = Response({
            'user': UserDetailSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)

        # Security: Set refresh token in HttpOnly cookie
        from django.conf import settings
        response.set_cookie(
            key='refresh_token',
            value=str(refresh),
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax',
            path='/',
            max_age=24 * 60 * 60
        )
        
        return response


class RequestPasswordResetView(generics.GenericAPIView):
    """
    Request a password reset link.
    """
    permission_classes = [AllowAny]
    serializer_class = None  # No serializer needed for simple email input

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email=email).first()
        if user:
            from django.contrib.auth.tokens import default_token_generator
            from django.utils.http import urlsafe_base64_encode
            from django.utils.encoding import force_bytes
            from django.core.mail import send_mail
            from django.conf import settings

            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Construct the reset link (Frontend URL)
            reset_link = f"{settings.CORS_ALLOWED_ORIGINS.split(',')[0]}/reset-password/{uid}/{token}/"
            
            # In a real app, send email. For now, print to console or return for debugging (in dev only).
            # send_mail(
            #     'Password Reset Request',
            #     f'Click here to reset your password: {reset_link}',
            #     settings.DEFAULT_FROM_EMAIL,
            #     [email],
            #     fail_silently=False,
            # )
            print(f"PASSWORD RESET LINK for {email}: {reset_link}") # For development/demo

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
    serializer_class = None

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('password')

        if not uidb64 or not token or not new_password:
            return Response({'error': 'Missing fields'}, status=status.HTTP_400_BAD_REQUEST)

        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_decode
        from django.utils.encoding import force_str

        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            user.set_password(new_password)
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


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User management."""
    
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """Limit user-management operations to admins; allow self-service updates."""
        if self.action in ['create', 'destroy', 'bulk_upload']:
            permission_classes = [IsAuthenticated, IsAdmin]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """
        Limit user visibility for privacy:
        - Students can list non-student roles (plus themselves for profile updates).
        - Staff/wardens/admins can see all users.
        """
        qs = User.objects.prefetch_related('groups').filter(is_active=True)
        user = self.request.user
        if getattr(user, 'role', None) == 'student':
            return qs.filter(Q(id=user.id) | ~Q(role='student'))
        return qs

    def get_object(self):
        """Prevent non-admins from reading/updating other users."""
        obj = super().get_object()
        if not user_is_admin(self.request.user) and obj.id != self.request.user.id:
            raise PermissionDenied('Not authorized.')
        return obj
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            # Use Admin-specific serializer if user is Admin/Staff (allowing role selection)
            # Default to UserCreateSerializer for public endpoint or limited use
            if user_is_admin(self.request.user) or getattr(self.request.user, 'is_superuser', False):
                return AdminUserCreateSerializer
            return UserCreateSerializer
        elif self.action == 'retrieve':
            return UserDetailSerializer
        return UserSerializer
    
    @action(detail=False, methods=['get'])
    def me(self, request):
        """Get current user details."""
        serializer = UserDetailSerializer(request.user)
        return Response(serializer.data)
    
    @action(detail=False, methods=['put'])
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
                'detail': 'Old password is incorrect.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if new_password != new_password_confirm:
            return Response({
                'detail': 'New passwords do not match.'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user.set_password(new_password)
        user.save()
        
        return Response({
            'detail': 'Password changed successfully.'
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], throttle_classes=[BulkOperationThrottle])
    def bulk_upload(self, request):
        """
        Bulk create users from a CSV file.
        
        RATE LIMITED: Prevents database hammering (5 requests/minute).
        """
        user = request.user
        if not user_is_admin(user):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        upload = request.FILES.get('file')
        if not upload:
            return Response({'detail': 'CSV file is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            csv_file = TextIOWrapper(upload.file, encoding='utf-8-sig')
            reader = csv.DictReader(csv_file)
        except Exception:
            return Response({'detail': 'Invalid CSV file.'}, status=status.HTTP_400_BAD_REQUEST)

        required_fields = ['hall_ticket', 'first_name', 'last_name']
        created = 0
        errors = []
        generated_passwords = []

        from django.db import transaction
        
        try:
            with transaction.atomic():
                for index, row in enumerate(reader, start=2):
                    try:
                        normalized = {k.strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}

                        # Pre-check required values (after mapping)
                        # We do this later now because keys are flexible

                        # Flexible header mapping
                        hall_ticket = (
                            normalized.get('hall_ticket') or 
                            normalized.get('username') or 
                            normalized.get('student hall ticket') or 
                            normalized.get('ht no')
                        )
                        hall_ticket = (hall_ticket or '').strip().upper()

                        first_name = normalized.get('first_name') or normalized.get('name')
                        last_name = normalized.get('last_name') or '' # Allow single name column if needed
                        
                        # FORCE student role for all CSV uploads
                        role = 'student'

                        phone_number = (
                            normalized.get('phone_number') or 
                            normalized.get('mobile') or 
                            normalized.get('stu mobile') or 
                            normalized.get('student mobile') or 
                            ''
                        )
                        password = normalized.get('password')

                        if not hall_ticket:
                            errors.append({'row': index, 'error': 'Hall ticket is required.'})
                            continue
                            
                        if not first_name:
                            # Try to split last_name if it was used as full name
                            if last_name:
                                names = last_name.split(' ', 1)
                                first_name = names[0]
                                if len(names) > 1:
                                    last_name = names[1]
                                else:
                                    last_name = ''
                            else:
                                 errors.append({'row': index, 'error': 'Name is required.'})
                                 continue

                        if User.objects.filter(username__iexact=hall_ticket).exists():
                            # Skip existing but don't fail transaction
                            errors.append({'row': index, 'error': f"Hall ticket already exists: {hall_ticket}"})
                            continue

                        if not password:
                            password = User.objects.make_random_password()
                            generated_passwords.append({'username': hall_ticket, 'password': password})

                        # Map fields with multiple possible CSV headers
                        father_name = normalized.get('father_name') or normalized.get('f_name') or ''
                        father_phone = normalized.get('father_phone') or normalized.get('f_mobile') or normalized.get('parent_phone') or ''
                        
                        mother_name = normalized.get('mother_name') or normalized.get('m_name') or ''
                        mother_phone = normalized.get('mother_phone') or normalized.get('m_mobile') or ''
                        
                        guardian_name = normalized.get('guardian_name') or normalized.get('g_name') or ''
                        guardian_phone = normalized.get('guardian_phone') or normalized.get('g_mobile') or ''
                        
                        college_code = (
                            normalized.get('college_code') or 
                            normalized.get('college') or 
                            normalized.get('college code') or 
                            ''
                        )
                        address = normalized.get('address') or ''

                        # Create user (expensive but safe)
                        created_user = User.objects.create_user(
                            username=hall_ticket,
                            first_name=first_name,
                            last_name=last_name,
                            registration_number=hall_ticket,
                            role=role,
                            phone_number=phone_number,
                            password=password,
                        )
                        group_name = 'Student' if role == 'student' else 'Staff' if role == 'staff' else 'Admin'
                        group, _ = Group.objects.get_or_create(name=group_name)
                        created_user.groups.add(group)

                        if role == 'student':
                            from apps.users.models import Tenant
                            Tenant.objects.update_or_create(
                                user=created_user,
                                defaults={
                                    'father_name': father_name,
                                    'father_phone': father_phone,
                                    'mother_name': mother_name,
                                    'mother_phone': mother_phone,
                                    'guardian_name': guardian_name,
                                    'guardian_phone': guardian_phone,
                                    'college_code': college_code,
                                    'address': address
                                }
                            )
                        
                        created += 1
                    except Exception as exc:
                        # Log error but don't break the whole loop for single row failure unless it's critical
                        # Actually, inside atomic block, a caught exception is fine as long as we don't bubble it up
                        # BUT, create_user might have dirtied the transaction if it failed at DB level.
                        # For now, we assume simple validation errors. 
                        errors.append({'row': index, 'error': str(exc)})
        except Exception as e:
            return Response({'detail': f'Bulk upload failed: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'created': created,
            'errors': errors,
            'generated_passwords': generated_passwords,
        }, status=status.HTTP_200_OK)
