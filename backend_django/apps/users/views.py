from rest_framework import viewsets, status, filters
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsStaff, IsWarden, user_is_admin, ROLE_HEAD_WARDEN
from core.role_scopes import get_warden_building_ids, user_is_top_level_management
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
    
    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        
        # Admin, Super Admin, Head Warden see all
        if user_is_top_level_management(user):
            return qs
        
        # Warden: See tenants in assigned building(s)
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            
            if not warden_buildings.exists():
                return qs  # Fail-safe: unassigned wardens see all
            
            # Filter tenants by their room allocation
            return qs.filter(
                user__room_allocations__room__building_id__in=warden_buildings,
                user__room_allocations__end_date__isnull=True
            ).distinct()
        
        # Staff see all (current behavior)
        return qs
    
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def bulk_upload(self, request):
        """
        Upload students via CSV with robust validation.
        Limits: 500 row batches.
        """
        import re
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            decoded_file = file_obj.read().decode('utf-8-sig')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
            
            # Flexible header mapping
            field_map = {
                'registration_number': ['reg_no', 'hall_ticket', 'username', 'roll_no'],
                'first_name': ['name', 'student_name'],
                'mobile': ['phone_number', 'phone', 'student_mobile'],
                'email': ['student_email'],
                'father_name': ['parent_name', 'guardian_name'],
                'father_phone': ['parent_phone', 'guardian_phone'],
            }
            
            rows = list(reader)
            if not rows:
                return Response({'error': 'Empty CSV file'}, status=status.HTTP_400_BAD_REQUEST)

            created_count = 0
            errors = []
            valid_rows = []
            
            # Validation Regex
            email_regex = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')
            phone_regex = re.compile(r'^\+?1?\d{9,15}$')
            
            seen_reg_nos = set()

            # 1. Validation Phase
            for idx, row in enumerate(rows, start=2):
                normalized = {k.strip().lower(): v.strip() for k, v in row.items() if k}
                
                def get_val(key):
                    if key in normalized: return normalized[key]
                    for alias in field_map.get(key, []):
                         if alias in normalized: return normalized[alias]
                    return ''

                reg_no = get_val('registration_number').upper()
                if not reg_no:
                    errors.append({'line': idx, 'error': 'Missing registration_number/hall_ticket'})
                    continue
                
                if reg_no in seen_reg_nos:
                    errors.append({'line': idx, 'error': f'Duplicate in file: {reg_no}'})
                    continue
                seen_reg_nos.add(reg_no)

                first_name = get_val('first_name')
                if not first_name:
                    errors.append({'line': idx, 'error': 'Missing Name'})
                    continue

                # Optional validations
                phone = get_val('mobile')
                if phone and not phone_regex.match(phone):
                     errors.append({'line': idx, 'error': f'Invalid phone: {phone}'})
                     continue
                
                email = get_val('email')
                if email and not email_regex.match(email):
                    errors.append({'line': idx, 'error': f'Invalid email: {email}'})
                    continue
                
                valid_rows.append({
                    'reg_no': reg_no,
                    'first_name': first_name,
                    'last_name': row.get('last_name', ''),
                    'phone': phone,
                    'email': email,
                    'father_name': get_val('father_name'),
                    'father_phone': get_val('father_phone'),
                    'mother_name': normalized.get('mother_name', ''),
                    'mother_phone': normalized.get('mother_phone', ''),
                    'address': normalized.get('address', ''),
                    'city': normalized.get('city', ''),
                    'state': normalized.get('state', ''),
                    'pincode': normalized.get('pincode', ''),
                    'college_code': normalized.get('college_code', '') or normalized.get('college', ''),
                    'line_no': idx
                })

            # 2. Database Phase (Batched)
            if valid_rows:
                # Filter out existing users
                existing_usernames = set(User.objects.filter(username__in=[r['reg_no'] for r in valid_rows]).values_list('username', flat=True))
                
                to_process = []
                for r in valid_rows:
                    if r['reg_no'] in existing_usernames:
                         errors.append({'line': r['line_no'], 'error': f'User {r["reg_no"]} already exists'})
                    else:
                         to_process.append(r)
                
                batch_size = 500
                for i in range(0, len(to_process), batch_size):
                    batch = to_process[i:i+batch_size]
                    
                    try:
                        with transaction.atomic():
                            for item in batch:
                                try:
                                    user = User.objects.create_user(
                                        username=item['reg_no'],
                                        registration_number=item['reg_no'],
                                        first_name=item['first_name'],
                                        last_name=item['last_name'],
                                        email=item['email'],
                                        phone_number=item['phone'],
                                        password='password123',
                                        role='student',
                                        is_active=True
                                    )
                                    
                                    group, _ = Group.objects.get_or_create(name='Student')
                                    user.groups.add(group)
                                    
                                    Tenant.objects.create(
                                        user=user,
                                        father_name=item['father_name'],
                                        father_phone=item['father_phone'],
                                        mother_name=item['mother_name'],
                                        mother_phone=item['mother_phone'],
                                        address=item['address'],
                                        city=item['city'],
                                        state=item['state'],
                                        pincode=item['pincode'],
                                        college_code=item['college_code'] or None
                                    )
                                    created_count += 1
                                except Exception as exc:
                                    errors.append({'line': item['line_no'], 'error': str(exc)})
                                    raise exc

                    except Exception as e:
                        # Batch transaction failed
                        for item in batch:
                             errors.append({'line': item['line_no'], 'error': f'Batch failed: {str(e)}'})

            return Response({
                'message': f'Processed. Created: {created_count}. Errors: {len(errors)}',
                'created_count': created_count,
                'errors': errors[:100]
            }, status=status.HTTP_200_OK if created_count > 0 else status.HTTP_400_BAD_REQUEST)
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
