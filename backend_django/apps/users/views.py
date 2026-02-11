from rest_framework import viewsets, status, filters
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsStaff, IsWarden, user_is_admin, ROLE_HEAD_WARDEN
from apps.users.models import Tenant
from apps.users.serializers import TenantSerializer

from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from django.db import transaction
from apps.auth.models import User
import csv
import io
from django.contrib.auth.models import Group

from django_filters.rest_framework import DjangoFilterBackend

class TenantViewSet(viewsets.ModelViewSet):
    # Optimize query with select_related to prevent N+1
    queryset = Tenant.objects.select_related('user').all().order_by('-created_at')
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated, IsStaff]
    
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    filterset_fields = ['user__groups__name']
    search_fields = [
        'user__username', 
        'user__first_name', 
        'user__last_name', 
        'user__registration_number',
        'city',
        'college_code'
    ]
    
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def bulk_upload(self, request):
        """Upload students via CSV."""
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            decoded_file = file_obj.read().decode('utf-8')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
            
            # Read all rows to memory (safe for <5k rows)
            rows = list(reader)
            if not rows:
                return Response({'error': 'Empty CSV file'}, status=status.HTTP_400_BAD_REQUEST)

            created_count = 0
            errors = []
            
            # 1. Prefetch existing users to remove N+1 queries
            usernames = set()
            for row in rows:
                reg_no = (
                    row.get('registration_number')
                    or row.get('reg_no')
                    or row.get('hall_ticket')
                    or row.get('username')
                )
                if reg_no:
                    usernames.add(reg_no.strip().upper())
            
            existing_users = set(User.objects.filter(username__in=usernames).values_list('username', flat=True))

            # 2. Process in batches to avoid long transaction locks
            batch_size = 100
            for i in range(0, len(rows), batch_size):
                batch_rows = rows[i:i+batch_size]
                
                # Commit transaction after each batch
                with transaction.atomic():
                    for row in batch_rows:
                        reg_no = (
                            row.get('registration_number')
                            or row.get('reg_no')
                            or row.get('hall_ticket')
                            or row.get('username')
                        )
                        reg_no = (reg_no or '').strip().upper()
                        
                        if not reg_no:
                            continue
                            
                        # Memory check instead of DB query
                        if reg_no in existing_users:
                            errors.append(f"User {reg_no} already exists")
                            continue
                        
                        try:
                            # Create User
                            user = User.objects.create_user(
                                username=reg_no,
                                email=row.get('email', ''),
                                first_name=row.get('first_name', ''),
                                last_name=row.get('last_name', ''),
                                password='password123',  # Default password
                                role='student',
                                registration_number=reg_no,
                                phone_number=row.get('phone_number', '')
                            )
                            
                            father_name = row.get('father_name') or row.get('parent_name') or row.get('guardian_name') or ''
                            father_phone = row.get('father_phone') or row.get('parent_phone') or row.get('guardian_phone') or ''
                            mother_name = row.get('mother_name') or ''
                            mother_phone = row.get('mother_phone') or ''
                            guardian_name = row.get('guardian_name') or ''
                            guardian_phone = row.get('guardian_phone') or ''

                            Tenant.objects.create(
                                user=user,
                                father_name=father_name,
                                father_phone=father_phone,
                                mother_name=mother_name,
                                mother_phone=mother_phone,
                                guardian_name=guardian_name,
                                guardian_phone=guardian_phone,
                                emergency_contact=row.get('emergency_contact', ''),
                                address=row.get('address', ''),
                                city=row.get('city', ''),
                                state=row.get('state', ''),
                                pincode=row.get('pincode', ''),
                                college_code=row.get('college_code', '') or None,
                            )
                            created_count += 1
                            existing_users.add(reg_no) # Prevent duplicates within same import
                            
                        except Exception as e:
                            errors.append(f"Error creating {reg_no}: {str(e)}")
            
            return Response({
                'message': f'Successfully created {created_count} students.',
                'errors': errors
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsWarden])
    def toggle_hr(self, request, pk=None):
        """Toggle Student HR status (Elect/Remove). Only for Head Warden & Admins."""
        tenant = self.get_object()
        user = tenant.user
        
        if not (user_is_admin(request.user) or request.user.role == ROLE_HEAD_WARDEN):
            return Response(
                {'detail': 'Only Head Warden or higher authority can elect HR representatives.'}, 
                status=status.HTTP_403_FORBIDDEN
            )

        group, _ = Group.objects.get_or_create(name='Student_HR')
        is_currently_hr = user.groups.filter(name='Student_HR').exists()
        
        # 'status': true to add, false to remove. If missing, toggle.
        target_status = request.data.get('status')
        
        if target_status is not None:
            should_add = bool(target_status)
        else:
            should_add = not is_currently_hr
            
        if should_add:
            user.groups.add(group)
            action_msg = "promoted to"
        else:
            user.groups.remove(group)
            action_msg = "removed from"
            
        return Response({
            'detail': f'Student {user.username} {action_msg} Student HR representative.',
            'is_student_hr': should_add
        })
