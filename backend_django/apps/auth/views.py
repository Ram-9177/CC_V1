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

from apps.auth.models import User
from apps.auth.serializers import (
    UserSerializer,
    UserDetailSerializer,
    UserCreateSerializer,
    CustomTokenObtainPairSerializer,
    LoginSerializer,
)
from core.permissions import user_is_admin


class CustomTokenObtainPairView(TokenObtainPairView):
    """Custom JWT token obtain view."""
    serializer_class = CustomTokenObtainPairSerializer


class LoginView(generics.GenericAPIView):
    """User login endpoint."""
    
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        """Handle login request."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']

        if not user.groups.exists():
            group, _ = Group.objects.get_or_create(name='Student')
            user.groups.add(group)
            user.role = 'student'
            user.save(update_fields=['role'])
        elif user.is_superuser:
            group, _ = Group.objects.get_or_create(name='Admin')
            user.groups.add(group)
            user.role = 'admin'
            user.save(update_fields=['role'])
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserDetailSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_200_OK)


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
        
        return Response({
            'user': UserDetailSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


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
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        if self.action == 'create':
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

    @action(detail=False, methods=['post'])
    def bulk_upload(self, request):
        """Bulk create users from a CSV file."""
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

        for index, row in enumerate(reader, start=2):
            try:
                normalized = {k.strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}

                missing = [f for f in required_fields if not normalized.get(f)]
                if missing:
                    errors.append({'row': index, 'error': f"Missing fields: {', '.join(missing)}"})
                    continue

                hall_ticket = normalized.get('hall_ticket') or normalized.get('username')
                first_name = normalized.get('first_name')
                last_name = normalized.get('last_name')
                role = normalized.get('role') or 'student'
                phone_number = normalized.get('phone_number') or ''
                password = normalized.get('password')

                if role not in ['student', 'staff', 'admin']:
                    role = 'student'

                if not hall_ticket:
                    errors.append({'row': index, 'error': 'Hall ticket is required.'})
                    continue

                if User.objects.filter(username=hall_ticket).exists():
                    errors.append({'row': index, 'error': f"Hall ticket already exists: {hall_ticket}"})
                    continue

                if not password:
                    password = User.objects.make_random_password()
                    generated_passwords.append({'username': hall_ticket, 'password': password})

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
                created += 1
            except Exception as exc:
                errors.append({'row': index, 'error': str(exc)})

        return Response({
            'created': created,
            'errors': errors,
            'generated_passwords': generated_passwords,
        }, status=status.HTTP_200_OK)
