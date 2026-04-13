from rest_framework import viewsets, status, filters
from rest_framework.permissions import IsAuthenticated
from core.permissions import (
    IsStaff,
    IsWarden,
    ROLE_HEAD_WARDEN,
    user_is_admin,
    user_is_top_level_management as user_is_top_level_management_perm,
)
from core.role_scopes import get_warden_building_ids, user_is_top_level_management, get_hr_building_ids, get_hr_floor_numbers
from apps.users.models import Tenant
from apps.users.serializers import TenantSerializer
from django.db.models import Prefetch, Q
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
from core.throttles import ActionScopedThrottleMixin
from core.permissions import user_is_super_admin
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
    
    # STRICT ISOLATION: A student cannot search and view other students' profiles.
    if user.role == 'student':
        return Response([])

    from apps.rooms.models import RoomAllocation

    # Base Query: Active students with active allocation prefetched for response shaping.
    qs = User.objects.filter(role='student', is_active=True).select_related('college').prefetch_related(
        Prefetch(
            'room_allocations',
            queryset=RoomAllocation.objects.filter(end_date__isnull=True).select_related('room', 'room__building'),
            to_attr='active_room_allocations',
        )
    )

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
        active_allocs = getattr(student, 'active_room_allocations', [])
        active_alloc = active_allocs[0] if active_allocs else None
        
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

class TenantViewSet(ActionScopedThrottleMixin, viewsets.ModelViewSet):
    # Optimize query with select_related and smart Prefetch to prevent N+1
    from apps.rooms.models import RoomAllocation
    from django.db.models import Prefetch

    queryset = Tenant.objects.select_related(
        'user', 'user__college'
    ).prefetch_related(
        'user__groups',
        Prefetch(
            'user__room_allocations',
            queryset=RoomAllocation.objects.filter(
                status='approved',
                end_date__isnull=True
            ).select_related('room', 'room__building'),
            to_attr='active_allocations'
        )
    ).all().order_by('-created_at')
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated, IsStaff]
    action_throttle_scopes = {'list': 'tenant_list'}
    
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

        if user_is_super_admin(user):
            return qs

        # College admin: same operational breadth as super_admin inside one tenant only.
        if getattr(user, 'role', None) == 'admin':
            if not user.college_id:
                return qs.none()
            return qs.filter(user__college_id=user.college_id)
        
        # Staff/Warden College Isolation: 
        # If they are assigned to a specific college, they only see students from that college.
        if user.college_id:
            qs = qs.filter(user__college_id=user.college_id)

        # Head Warden: See tenants in their hostel/assigned buildings
        if user.role == 'head_warden':
            hw_buildings = get_warden_building_ids(user)
            if hw_buildings:
                return qs.filter(
                    Q(user__room_allocations__room__building_id__in=hw_buildings, user__room_allocations__end_date__isnull=True) |
                    Q(user__room_allocations__isnull=True)
                ).distinct()
            return qs
        
        # Warden: See tenants in assigned building(s) OR students with NO allocation
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            
            if not warden_buildings:
                return qs  # Fail-safe: unassigned wardens see only their college students (if restricted) or all
            
            # Filter tenants: 
            # 1. Already in my building
            # 2. NOT in any building (unallocated - needed for "Allocate" search)
            return qs.filter(
                Q(user__room_allocations__room__building_id__in=warden_buildings, user__room_allocations__end_date__isnull=True) |
                Q(user__room_allocations__isnull=True)
            ).distinct()

        # HR: See tenants in assigned buildings + floors
        if user.role == 'hr' or getattr(user, 'is_student_hr', False):
            hr_buildings = get_hr_building_ids(user)
            if hr_buildings:
                filter_q = Q(user__room_allocations__room__building_id__in=hr_buildings, user__room_allocations__end_date__isnull=True)
                hr_floors = get_hr_floor_numbers(user)
                if hr_floors:
                    filter_q &= Q(user__room_allocations__room__floor__in=hr_floors)
                return qs.filter(filter_q).distinct()
            return qs.none()
        
        # Staff see filtered qs
        return qs
    
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def bulk_upload(self, request):
        """
        Upload students via CSV (same pipeline as UserViewSet.bulk_upload).
        Limits: 500 rows. Default password: student phone digits + @ + same digits.
        """
        from apps.users.student_csv_import import (
            create_students_from_valid_items,
            validate_student_csv_rows,
        )

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            decoded_file = file_obj.read().decode('utf-8-sig')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
            rows = list(reader)
            if not rows:
                return Response({'error': 'Empty CSV file'}, status=status.HTTP_400_BAD_REQUEST)

            valid_items, val_errors = validate_student_csv_rows(
                rows,
                request.user,
                error_key='line',
                enforce_max_rows=True,
                students_only=True,
            )
            created_count, db_errors, credentials = create_students_from_valid_items(
                request.user, valid_items, error_key='line'
            )
            errors = val_errors + db_errors

            errors_list: list = list(errors)
            return Response(
                {
                    'message': f'Processed. Created: {created_count}. Errors: {len(errors_list)}',
                    'created_count': created_count,
                    'errors': errors_list[:100],
                    'generated_passwords': credentials,
                },
                status=status.HTTP_200_OK if created_count > 0 else status.HTTP_400_BAD_REQUEST,
            )

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['get'])
    def download_template(self, request):
        """Canonical student CSV template (super_admin, admin, head_warden, Django superuser)."""
        from django.http import HttpResponse

        from apps.users.student_csv_import import write_student_csv_template

        if not user_is_top_level_management_perm(request.user):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="student_upload_template.csv"'
        writer = csv.writer(response)
        write_student_csv_template(writer)
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
