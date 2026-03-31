from rest_framework import viewsets, status, filters
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsStaff, IsWarden, user_is_admin, ROLE_HEAD_WARDEN
from core.role_scopes import get_warden_building_ids, user_is_top_level_management
from apps.users.models import Tenant
from apps.users.serializers import TenantSerializer
from django.db.models import Q
import logging
import hashlib
from django.utils import timezone

from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from django.db import transaction
from apps.auth.models import User
import csv
import io
from django.contrib.auth.models import Group

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Value
from django.db.models.functions import Concat

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_search(request):
    """
    Search students by name, roll number, hostel name, room number, or mobile.
    Used for Fine Management and other modules.
    """
    from apps.auth.models import User
    from core.role_scopes import get_warden_building_ids, user_is_top_level_management

    query = request.GET.get('q', '').strip()
    if not query:
        return Response([])

    user = request.user
    
    # Base Query: Active students
    qs = User.objects.filter(role='student', is_active=True).select_related('college').prefetch_related('room_allocations__room__building')

    # Security: Wardens only see students in their blocks or unallocated students
    if user.role == 'warden':
        warden_buildings = get_warden_building_ids(user)
        if warden_buildings.exists():
            qs = qs.filter(
                Q(room_allocations__room__building_id__in=warden_buildings, room_allocations__end_date__isnull=True) |
                Q(room_allocations__isnull=True)
            ).distinct()
    elif not user_is_top_level_management(user) and user.college_id:
        qs = qs.filter(college_id=user.college_id)

    # Search Logic
    qs = qs.annotate(
        full_name=Concat('first_name', Value(' '), 'last_name')
    )
    qs = qs.filter(
        Q(full_name__icontains=query) |
        Q(username__icontains=query) |
        Q(phone_number__icontains=query) |
        Q(room_allocations__room__room_number__icontains=query) |
        Q(room_allocations__room__building__name__icontains=query)
    ).distinct()

    # Limit to reasonable number
    qs = qs[:20]

    # Format Results
    results = []
    for student in qs:
        # Get active room allocation safely
        allocs = [a for a in student.room_allocations.all() if not a.end_date]
        active_alloc = allocs[0] if allocs else None
        
        results.append({
            'id': student.id,
            'name': student.get_full_name().strip() or student.username,
            'username': student.username,
            'room_number': active_alloc.room.room_number if active_alloc and active_alloc.room else None,
            'hostel_name': active_alloc.room.building.name if active_alloc and active_alloc.room and hasattr(active_alloc.room, 'building') else None,
        })
        
    return Response(results)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_digital_id(request):
    """
    Generate a dynamic, secure Digital ID token.
    Used for QR scanners across the campus (id-cards, library, etc).
    Rolls every 30 seconds to prevent static screenshots.
    Format: ID:<reg_no>:<timestamp_bucket>:<sign>
    """
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Only students have Digital IDs'}, status=status.HTTP_403_FORBIDDEN)
    
    # 30-second window buckets for the token
    time_bucket = int(timezone.now().timestamp() / 30)
    reg_no = user.registration_number
    
    # Sign with SECRET_KEY for authenticity
    from django.conf import settings
    raw_str = f"{reg_no}:{time_bucket}:{settings.SECRET_KEY}"
    signature = str(hashlib.sha256(raw_str.encode()).hexdigest())[:8]
    
    token = f"ID:{reg_no}:{time_bucket}:{signature}"
    return Response({
        'token': token,
        'student': {
            'name': user.get_full_name(),
            'reg_no': reg_no,
            'college': user.college.name if user.college else ''
        },
        'expires_in': 30 - (int(timezone.now().timestamp()) % 30)
    })

class TenantViewSet(viewsets.ModelViewSet):
    # Optimize query with select_related and smart Prefetch to prevent N+1
    from apps.rooms.models import RoomAllocation
    from django.db.models import Prefetch

    queryset = Tenant.objects.select_related(
        'user', 'user__college'
    ).prefetch_related(
        'user__groups',
        Prefetch(
            'user__room_allocations',
            queryset=RoomAllocation.objects.filter(status='approved', end_date__isnull=True).select_related('room'),
            to_attr='active_allocations'
        )
    ).all().order_by('-created_at')
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated, IsStaff]
    
    filter_backends = [filters.SearchFilter, DjangoFilterBackend]
    filterset_fields = ['user__groups__name', 'user__is_active', 'user__college']
    search_fields = [
        'user__username', 
        'user__first_name', 
        'user__last_name', 
        'user__registration_number',
        'city',
        'college_code',
        'user__phone_number',
        'user__room_allocations__room__room_number',
        'user__room_allocations__room__building__name',
    ]
    
    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        
        # Admin, Super Admin, Head Warden see all
        if user_is_top_level_management(user):
            return qs
        
        # Staff/Warden College Isolation: 
        # If they are assigned to a specific college, they only see students from that college.
        if user.college_id:
            qs = qs.filter(user__college_id=user.college_id)
        
        # Warden: See tenants in assigned building(s) OR students with NO allocation
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            
            if not warden_buildings.exists():
                return qs  # Fail-safe: unassigned wardens see only their college students (if restricted) or all
            
            # Filter tenants: 
            # 1. Already in my building
            # 2. NOT in any building (unallocated - needed for "Allocate" search)
            return qs.filter(
                Q(user__room_allocations__room__building_id__in=warden_buildings, user__room_allocations__end_date__isnull=True) |
                Q(user__room_allocations__isnull=True)
            ).distinct()
        
        # Staff see filtered qs
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
                'registration_number': ['reg_no', 'hall_ticket', 'username', 'roll_no', 'ht no', 'student hall ticket'],
                'first_name': ['name', 'student_name'],
                'mobile': ['phone_number', 'phone', 'student_mobile', 'stu mobile', 'student mobile'],
                'email': ['student_email', 'email'],
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
                if not email:
                    errors.append({'line': idx, 'error': 'Missing Email Address (Required for password reset notifications)'})
                    continue
                if not email_regex.match(email):
                    errors.append({'line': idx, 'error': f'Invalid email: {email}'})
                    continue
                
                college_code = normalized.get('college_code', '') or normalized.get('college', '')
                
                # Validate College Code if provided
                from apps.colleges.models import College
                if college_code and not College.objects.filter(code=college_code).exists():
                     errors.append({'line': idx, 'error': f'Invalid college code: {college_code}'})
                     continue

                valid_rows.append({
                    'reg_no': reg_no,
                    'first_name': first_name,
                    'last_name': row.get('last_name', ''),
                    'phone': phone,
                    'email': email,
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
                    'college_code': college_code,
                    'line_no': idx
                })

            # 2. Database Phase (Batched)
            if valid_rows:
                # Filter out existing users
                existing_usernames = set(User.objects.filter(username__in=[r['reg_no'] for r in valid_rows]).values_list('username', flat=True))
                
                to_process: list = []
                for r in valid_rows:
                    if r['reg_no'] in existing_usernames:
                         errors.append({'line': r['line_no'], 'error': f'User {r["reg_no"]} already exists'})
                    else:
                         to_process.append(r)
                
                batch_size = 500
                to_process_list: list = list(to_process)
                for i in range(0, len(to_process_list), batch_size):
                    batch = to_process_list[i:i+batch_size]
                    
                    try:
                        with transaction.atomic():
                            for item in batch:
                                try:
                                    from core.permissions import user_is_top_level_management
                                    from apps.colleges.models import College
                                    
                                    # College Isolation Check for Bulk Upload
                                    if not user_is_top_level_management(request.user) and request.user.college_id:
                                        warden_college_code = getattr(request.user.college, 'code', None)
                                        if item['college_code'] and item['college_code'] != warden_college_code:
                                            raise Exception(f"Unauthorized college code: {item['college_code']}. You can only upload students for {warden_college_code}.")
                                        # Auto-set if missing
                                        if not item['college_code']:
                                            item['college_code'] = warden_college_code

                                    college_obj = College.objects.filter(code=item['college_code']).first() if item['college_code'] else None
                                    
                                    user = User.objects.create_user(
                                        username=item['reg_no'],
                                        registration_number=item['reg_no'],
                                        first_name=item['first_name'],
                                        last_name=item['last_name'],
                                        email=item['email'],
                                        phone_number=item['phone'],
                                        password='password123',
                                        role='student',
                                        college=college_obj,
                                        is_active=True,
                                        is_approved=True,
                                        is_password_changed=True
                                    )
                                    
                                    group, _ = Group.objects.get_or_create(name='Student')
                                    user.groups.add(group)
                                    
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
                                except Exception as exc:
                                    errors.append({'line': item['line_no'], 'error': str(exc)})
                                    raise exc

                    except Exception as e:
                        # Batch transaction failed
                        for item in batch:
                             errors.append({'line': item['line_no'], 'error': f'Batch failed: {str(e)}'})

            errors_list: list = list(errors)
            return Response({
                'message': f'Processed. Created: {created_count}. Errors: {len(errors_list)}',
                'created_count': created_count,
                'errors': errors_list[:100]
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
            user.is_student_hr = True
            action_msg = "promoted to"
        else:
            user.groups.remove(group)
            user.is_student_hr = False
            action_msg = "removed from"
        
        user.save(update_fields=['is_student_hr'])
            
        return Response({
            'detail': f'Student {user.username} {action_msg} Student HR representative.',
            'is_student_hr': should_add
        })
