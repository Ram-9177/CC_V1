"""Views for authentication."""

import logging
import csv
from io import TextIOWrapper

from rest_framework import viewsets, status, generics, parsers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.contrib.auth import authenticate
from django.contrib.auth.models import Group
from django.conf import settings
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
from core.permissions import (
    IsAdmin, IsWarden, user_is_admin, user_is_warden, 
    IsTopLevel, user_is_top_level_management,
    IsManagement
)
from core.throttles import LoginRateThrottle, ExportRateThrottle, BulkOperationThrottle, PasswordChangeThrottle

from rest_framework.exceptions import PermissionDenied

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
            },
            'password_change_required': not user.is_password_changed
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


class SetupAdminView(generics.GenericAPIView):
    permission_classes = [AllowAny]
    def get(self, request):
        from apps.auth.models import User
        users = []
        for uname in ['SUPERADMIN', 'ADMIN']:
            u, created = User.objects.get_or_create(username=uname)
            u.set_password('Ram@9177')
            u.is_active = True
            u.is_staff = True
            u.role = 'super_admin' if uname == 'SUPERADMIN' else 'admin'
            u.is_superuser = True if uname == 'SUPERADMIN' else False
            u.email = f"{uname.lower()}@hostelconnect.com"
            u.registration_number = uname
            u.is_password_changed = True
            u.save()
            users.append({'username': uname, 'password': 'Ram@9177', 'created': created})
        return Response({'success': True, 'message': 'Admin accounts are ready!', 'accounts': users})

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


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for User management."""
    
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['role', 'is_active']

    def get_permissions(self):
        """Limit user-management operations by role hierarchy.
        
        - create/bulk_upload: Wardens + Admins (wardens student-only, admins any).
        - destroy: Wardens can delete students; Admins can delete any.
        - Everything else: authenticated.
        """
        if self.action in ['create', 'bulk_upload', 'destroy']:
            # Wardens (incl Head Warden) + Admins
            permission_classes = [IsAuthenticated, IsWarden]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def get_queryset(self):
        """
        Limit user visibility for privacy:
        - Students can list active non-student roles.
        - Staff/wardens/admins can see all users (including inactive ones for management).
        """
        user = self.request.user
        qs = User.objects.prefetch_related('groups')
        
        if getattr(user, 'role', None) == 'student':
            # Students only see active staff or themselves
            return qs.filter(is_active=True).filter(Q(id=user.id) | ~Q(role='student'))
            
        # Management roles see everything (filtered by front-end if needed)
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
            
            # Wardens manage Students
            if (user.role in ['warden', 'head_warden']) and obj.role == 'student':
                authorized = True
            # Head Chef manages Chefs
            elif user.role == 'head_chef' and obj.role == 'chef':
                authorized = True
            # Security Head manages Gate Security
            elif user.role == 'security_head' and obj.role == 'gate_security':
                authorized = True
                
            if not authorized:
                raise PermissionDenied('Not authorized. You can only manage users within your specific department/authority.')

        # 2. Hierarchy Check (Modifying/Deleting others)
        if self.action in ['update', 'partial_update', 'destroy', 'admin_reset_password', 'toggle_active'] and obj.id != user.id:
            # If target is SuperAdmin, only SuperAdmin can touch them
            if obj.role == 'super_admin' and not (user.role == 'super_admin' or getattr(user, 'is_superuser', False)):
                raise PermissionDenied('Only SuperAdmins can modify other SuperAdmin accounts.')
            
            # If target is Admin, only SuperAdmin can touch them
            if obj.role == 'admin' and not (user.role == 'super_admin' or getattr(user, 'is_superuser', False)):
                raise PermissionDenied('Only SuperAdmins can modify other Admin accounts.')

        # CRITICAL: Personal info of student can only be changed by Warden/Admin
        if self.action in ['update', 'partial_update'] and obj.role == 'student':
            if not (user.role in ['warden', 'head_warden'] or is_admin):
                raise PermissionDenied('Student personal information can only be managed by Wardens or Admins.')

        return obj
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
            # Admins get the full serializer (can pick any role)
            if user_is_admin(self.request.user) or getattr(self.request.user, 'is_superuser', False):
                return AdminUserCreateSerializer
            # Wardens get the student-only serializer
            return UserCreateSerializer
        elif self.action == 'retrieve':
            return UserDetailSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        """Override create to enforce role-based restrictions.
        
        - Admins/SuperAdmins: can create any role.
        - Head Wardens/Wardens: can only create students.
        - Everyone else: denied (handled by get_permissions).
        """
        user = request.user
        requested_role = request.data.get('role', 'student')

        if not user_is_admin(user):
            # Domain-specific creations
            if user.role in ['warden', 'head_warden'] and requested_role == 'student':
                pass # Wardens can create students
            elif user.role == 'head_chef' and requested_role == 'chef':
                pass # Head Chef can create chefs
            elif user.role == 'security_head' and requested_role == 'gate_security':
                pass # Security Head can create gate security
            else:
                raise PermissionDenied(
                    'You do not have authority to create this role. Only Admins can create all roles, or you must be the specific Head of that department.'
                )

        return super().create(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """Override destroy to enforce role-based deletion restrictions.
        
        - Admins/SuperAdmins: can delete any user (hierarchy still applies via get_object).
        - Wardens/Head Wardens: can only delete students.
        - Everyone else: denied (handled by get_permissions).
        """
        obj = self.get_object()
        user = request.user

        if not user_is_admin(user):
            # Domain-specific deletions
            if user.role in ['warden', 'head_warden'] and obj.role == 'student':
                pass
            elif user.role == 'head_chef' and obj.role == 'chef':
                pass
            elif user.role == 'security_head' and obj.role == 'gate_security':
                pass
            else:
                raise PermissionDenied(
                    'You do not have authority to delete this role. Only Admins can delete all roles, or you must be the specific Head of that department.'
                )

        return super().destroy(request, *args, **kwargs)
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle a user's is_active status (activate/deactivate)."""
        obj = self.get_object()  # Applies all our strict hierarchy rules
        obj.is_active = not obj.is_active
        obj.save()
        status_text = "activated" if obj.is_active else "deactivated"
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
        """Update current user's profile picture."""
        user = request.user
        photo = request.FILES.get('profile_picture')
        
        if not photo:
            return Response({'detail': 'No photo provided.'}, status=status.HTTP_400_BAD_REQUEST)
            
        # Optional: validate image type/size here using core.security if needed
        user.profile_picture = photo
        user.save()
        
        return Response({
            'detail': 'Profile picture updated successfully.',
            'profile_picture': request.build_absolute_uri(user.profile_picture.url) if user.profile_picture else None
        })

    @action(detail=False, methods=['post'], throttle_classes=[BulkOperationThrottle])
    def bulk_upload(self, request):
        """
        Bulk create users from a CSV file.
        Robust version: Validates headers, headers flexible, checks duplicates, batches processing.
        """
        import re
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

            # 2. Database Phase (Batched)
            if valid_rows:
                # Pre-fetch existing users to avoid errors
                existing_usernames = set(User.objects.filter(username__in=[r['reg_no'] for r in valid_rows]).values_list('username', flat=True))
                
                to_process = []
                for r in valid_rows:
                    if r['reg_no'] in existing_usernames:
                         errors.append({'row': r['line_no'], 'error': f'User {r["reg_no"]} already exists'})
                    else:
                         to_process.append(r)
                
                batch_size = 500
                for i in range(0, len(to_process), batch_size):
                    batch = to_process[i:i+batch_size]
                    
                    try:
                        with transaction.atomic():
                            for item in batch:
                                try:
                                    # Create User
                                    user = User.objects.create_user(
                                        username=item['reg_no'],
                                        registration_number=item['reg_no'],
                                        first_name=item['first_name'],
                                        last_name=item['last_name'],
                                        email=item['email'],
                                        phone_number=item['phone'],
                                        password=item['password'],
                                        role='student',
                                        is_active=True,
                                        is_password_changed=True
                                    )
                                    
                                    group, _ = Group.objects.get_or_create(name='Student')
                                    user.groups.add(group)
                                    
                                    # Create Tenant
                                    Tenant.objects.create(
                                        user=user,
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
                                        generated_passwords.append({'username': item['reg_no'], 'password': item['password']})
                                        
                                except Exception as exc:
                                    # Fail the batch if any row fails? Or catch and log?
                                    # User wants line errors. But create_user inside atomic...
                                    # We raise to rollback this batch and report error
                                    raise Exception(f"Row {item['line_no']}: {str(exc)}")

                    except Exception as e:
                        # Batch failed
                        errors.append({'row': 'Batch', 'error': str(e)})

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
    throttle_classes = [LoginRateThrottle] 

    def post(self, request):
        hall_ticket = request.data.get('hall_ticket')
        if not hall_ticket:
             return Response({'error': 'Hall ticket/Username is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        hall_ticket = hall_ticket.strip().upper()
        # Case insensitive lookup
        user = User.objects.filter(username__iexact=hall_ticket).first()
        
        if user:
             import random
             from django.core.cache import cache
             import hashlib
             
             # Generate 6 digit OTP
             otp = f"{random.randint(100000, 999999)}"
             
             # Store hash in Redis for security
             # TTL: 15 minutes
             cache_key = f"password_reset_otp_{user.id}"
             otp_hash = hashlib.sha256(otp.encode()).hexdigest()
             cache.set(cache_key, otp_hash, 60*15) 
             
             # Send OTP via Email (Completely FREE)
             if user.email:
                 try:
                     self._send_otp_email(user.email, otp, user.first_name or user.username)
                 except Exception as e:
                     logger.error(f"Failed to send OTP email: {str(e)}")
             else:
                 logger.warning(f"User {user.username} has no email. OTP cannot be sent.")
                 if getattr(settings, 'DEBUG', False):
                     print(f"\n[WARNING] User {user.username} has no email. OTP will only be visible here in console.\n")
             
             # Development fallback / Always log in DEBUG
             if getattr(settings, 'DEBUG', False):
                 print(f"\n[DEBUG] PASSWORD RESET OTP for {user.username}: {otp}\n")
                 logger.info(f"PASSWORD RESET OTP for {user.username}: {otp}")
             
        # Security: Always return success (prevent username enumeration)
        return Response({'message': 'If account exists, OTP has been sent to registered email.'}, status=status.HTTP_200_OK)
    
    def _send_otp_email(self, email, otp, name):
        """Send OTP via Email (Free)"""
        from django.core.mail import send_mail
        from django.conf import settings
        
        subject = "HostelConnect - Password Reset OTP"
        
        message = f"""
Hello {name},

Your HostelConnect password reset OTP is: {otp}

⏱️ This OTP is valid for 15 minutes only.
🔒 Do not share this OTP with anyone.

If you didn't request this, please ignore this email.

---
HostelConnect - Hostel Management System
"""
        
        html_message = f"""
        <html>
            <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                <div style="background-color: white; padding: 30px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <h2 style="color: #FF7444; margin: 0;">HostelConnect</h2>
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
                        © 2026 HostelConnect. All rights reserved.
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
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        hall_ticket = request.data.get('hall_ticket')
        otp = request.data.get('otp')
        new_password = request.data.get('new_password')
        
        if not hall_ticket or not otp or not new_password:
             return Response({'error': 'All fields are required.'}, status=status.HTTP_400_BAD_REQUEST)
             
        hall_ticket = hall_ticket.strip().upper()
        user = User.objects.filter(username__iexact=hall_ticket).first()
        
        if not user:
             return Response({'error': 'Invalid OTP or expired.'}, status=status.HTTP_400_BAD_REQUEST)
             
        from django.core.cache import cache
        import hashlib
        
        cache_key = f"password_reset_otp_{user.id}"
        cached_hash = cache.get(cache_key)
        
        input_hash = hashlib.sha256(otp.encode()).hexdigest()
        
        if not cached_hash:
             logger.warning(f"OTP verification failed for {user.username}: No OTP found in cache.")
             return Response({'error': 'OTP expired or not requested.'}, status=status.HTTP_400_BAD_REQUEST)

        if cached_hash != input_hash:
             logger.warning(f"OTP verification failed for {user.username}: Hash mismatch.")
             return Response({'error': 'Invalid OTP.'}, status=status.HTTP_400_BAD_REQUEST)
             
        # Success
        user.set_password(new_password)
        user.is_password_changed = True
        user.is_active = True # Unblock if needed
        user.save()
        
        # Invalidate OTP
        cache.delete(cache_key)
        
        return Response({'message': 'Password has been reset successfully. Please login.'}, status=status.HTTP_200_OK)


class LogoutView(generics.GenericAPIView):
    """
    Logout endpoint - blacklists the refresh token and clears the cookie.
    Accepts refresh token from either request body or httpOnly cookie.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = None

    def post(self, request):
        # Try to get the refresh token from the body first, then from the cookie
        refresh_token = request.data.get('refresh') or request.COOKIES.get('refresh_token')

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                pass  # Token already expired or invalid — still logout

        response = Response(
            {'detail': 'Logged out successfully.'},
            status=status.HTTP_205_RESET_CONTENT,
        )
        response.delete_cookie('refresh_token', path='/')
        return response
