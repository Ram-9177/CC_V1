"""Attendance viewsets and views."""

from rest_framework import viewsets, status
from django.db.models import Count, Q, Max, Prefetch
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from core.permissions import (
    IsWarden, IsAdmin, user_is_admin, user_is_staff, 
    STAFF_ROLES, IsHR, user_is_hr, user_is_super_admin
)
from core.college_mixin import CollegeScopeMixin
from core.date_utils import parse_iso_date_or_none
from core.role_scopes import (
    get_warden_building_ids, user_is_top_level_management,
    get_hr_building_ids, get_hr_floor_numbers, has_scope_access
)
from datetime import timedelta, date, datetime
from django.utils import timezone
from .models import Attendance, AttendanceReport
from .services import AttendanceService
from .serializers import AttendanceSerializer, AttendanceReportSerializer
from apps.auth.models import User
from apps.rooms.models import RoomAllocation
from apps.gate_passes.models import GatePass
from core.throttles import BulkOperationThrottle, ExportRateThrottle
from core.throttles import ActionScopedThrottleMixin
from core.services import get_attendance_stats
from django.http import StreamingHttpResponse


class AttendanceViewSet(ActionScopedThrottleMixin, CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for Attendance management."""
    
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    from core.pagination import StandardPagination
    pagination_class = StandardPagination
    action_throttle_scopes = {
        'mark': 'attendance_mark',
        'mark_all': 'attendance_mark_all',
        'sync_missing_records': 'attendance_sync_missing',
    }
    
    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'mark', 'mark_all', 'sync_missing_records']:
            # HR, Warden, and Admin can modify, but hierarchical checks occur in the logic
            return [IsAuthenticated(), (IsAdmin | IsWarden | IsHR)()]
        else:
            # All authenticated users can read (filtered by queryset)
            return [IsAuthenticated()]
    
    def get_queryset(self):
        """Filter queryset based on user role and assigned scope."""
        user = self.request.user
        # Use CollegeScopeMixin's get_queryset for college isolation
        queryset = super().get_queryset().select_related('user', 'block', 'locked_by')

        date_param = self.request.query_params.get('date')
        target_date = parse_iso_date_or_none(date_param)
        if target_date:
            queryset = queryset.filter(attendance_date=target_date)

        # 1. Admin, Super Admin, Head Warden, Chef see all
        if user_is_top_level_management(user) or user.role == 'chef':
            return queryset
        
        # 2. Warden/HR: See attendance from students in their assigned blocks/floors
        if user.role == 'warden' or user_is_hr(user):
            # Combine buildings from both Warden and HR assignments
            building_ids = get_warden_building_ids(user)
            hr_building_ids = get_hr_building_ids(user)
            
            # Combine unique building IDs
            all_building_ids = list(set(list(building_ids) + list(hr_building_ids)))

            floor_numbers = get_hr_floor_numbers(user)
            
            filter_q = Q()
            if all_building_ids:
                filter_q |= Q(user__room_allocations__room__building_id__in=all_building_ids, user__room_allocations__end_date__isnull=True)
            
            if floor_numbers:
                filter_q |= Q(user__room_allocations__room__floor__in=floor_numbers, user__room_allocations__end_date__isnull=True)
            
            if not filter_q: # If no specific assignments, return empty or default to self (depending on policy)
                return queryset.none() # Or handle as per business logic, e.g., queryset.filter(user=user)

            return queryset.filter(filter_q).distinct()

        # 3. Student/Other: Default to self
        return queryset.filter(user=user)

    def _attendance_result_response(self, result):
        if result.record is not None:
            payload = self.get_serializer(result.record).data
            if result.payload:
                payload.update(result.payload)
            return Response(payload, status=result.status_code)
        return Response(result.payload or {}, status=result.status_code)

    def list(self, request, *args, **kwargs):
        """Return attendance records with student details for a date.
        OPTIMIZED: Prevents loading 2000+ full User objects into RAM.
        PHASE 1: Students STRICTLY get only their own attendance.
        """
        user = request.user
        date_param = request.query_params.get('date')

        # PHASE 1: Students are short-circuited to only see their own record
        if user.role == 'student':
            target_date = parse_iso_date_or_none(date_param) if date_param else date.today()
            records = Attendance.objects.filter(user=user, attendance_date=target_date)
            serializer = self.get_serializer(records, many=True)
            return Response(serializer.data)
        target_date = date.today()

        if date_param:
            parsed_date = parse_iso_date_or_none(date_param)
            if not parsed_date:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
            target_date = parsed_date

        if user.role in STAFF_ROLES or user.role == 'chef':
            # 1. Base query for students (role-filtered, college-scoped)
            college = getattr(user, 'college', None)
            cf = Q(college=college) if college else Q()
            students_qs = User.objects.filter(cf & Q(role='student', is_active=True))
            
            building_id = request.query_params.get('building_id')
            floor = request.query_params.get('floor')
            
            # Application of Warden Block Restriction
            if user.role == 'warden' and not building_id:
                warden_buildings = get_warden_building_ids(user)
                students_qs = students_qs.filter(
                    room_allocations__room__building_id__in=warden_buildings, 
                    room_allocations__end_date__isnull=True
                )
            elif building_id:
                students_qs = students_qs.filter(
                    room_allocations__room__building_id=building_id, 
                    room_allocations__end_date__isnull=True
                )
            elif floor:
                students_qs = students_qs.filter(
                    room_allocations__room__floor=floor, 
                    room_allocations__end_date__isnull=True
                )
            
            # Final fallback/safety limit - CAP at 300 to survive on free tier RAM
            if not building_id and user_is_top_level_management(user):
                students_qs = students_qs[:300]

            # OPTIMIZATION: Use values() to fetch exactly what's needed as a dict list.
            # This avoids heavy Model instantiation of 300+ User objects.
            students_data = list(students_qs.values('id', 'first_name', 'last_name', 'username'))
            student_ids = [s['id'] for s in students_data]

            # 2. Fetch Room Allocations for these students in ONE query (values only)
            allocations = RoomAllocation.objects.filter(
                student_id__in=student_ids, 
                end_date__isnull=True,
                status='approved'
            ).values('student_id', 'room__room_number')
            alloc_map = {a['student_id']: a['room__room_number'] for a in allocations}
            
            # 3. Fetch Attendance records (values only)
            records = Attendance.objects.filter(
                attendance_date=target_date, 
                user_id__in=student_ids
            ).values('user_id', 'id', 'status', 'updated_at')
            record_map = {r['user_id']: r for r in records}

            # 4. Fetch Active Gate Passes (values only)
            start_of_day = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_of_day = datetime.combine(target_date, datetime.max.time()).replace(tzinfo=timezone.utc)
            
            active_passes = GatePass.objects.filter(
                student_id__in=student_ids,
                status__in=['out', 'outside', 'used', 'late_return'],
                exit_date__lte=end_of_day
            ).filter(
                Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
            ).values('student_id', 'pass_type', 'status', 'exit_date', 'entry_date')
            pass_map = {p['student_id']: p for p in active_passes}

            # 5. Build final payload
            payload = []
            for student in students_data:
                sid = student['id']
                record = record_map.get(sid)
                room_number = alloc_map.get(sid)
                gate_pass = pass_map.get(sid)
                
                name = f"{student['first_name']} {student['last_name']}".strip() or student['username']
                
                payload.append({
                    'id': record['id'] if record else sid,
                    'student': {
                        'id': sid,
                        'name': name,
                        'hall_ticket': student['username'],
                        'room_number': room_number,
                    },
                    'date': target_date.isoformat(),
                    'status': record['status'] if record else 'absent',
                    'gate_pass': gate_pass,
                    'marked_at': record['updated_at'] if record else None,
                })

            return Response(payload)

        # Student personal view - STRICT LIMITATION
        if user.role == 'student':
            records = Attendance.objects.filter(user=user, attendance_date=target_date).select_related('user', 'block', 'locked_by')
            serializer = self.get_serializer(records, many=True)
            return Response(serializer.data)

        # Fallback for other non-staff roles
        return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=False, methods=['post'])
    def sync_missing_records(self, request):
        """Backfill missing attendance records for a specific date."""
        if not (user_is_top_level_management(request.user) or request.user.role == 'warden' or user_is_hr(request.user)):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        target_date_str = request.data.get('date')
        target_date = parse_iso_date_or_none(target_date_str) or date.today()

        result = AttendanceService.sync_missing_records(actor=request.user, target_date=target_date)
        return self._attendance_result_response(result)

    @action(detail=False, methods=['post'])
    def mark(self, request):
        """Mark attendance for a student and date with hierarchical locking enforcement."""
        student_id = request.data.get('student_id')
        status_value = request.data.get('status')
        date_value = request.data.get('date')

        if not student_id or not status_value:
            return Response({'detail': 'student_id and status are required.'}, status=status.HTTP_400_BAD_REQUEST)

        attendance_date = parse_iso_date_or_none(date_value) if date_value else date.today()

        result = AttendanceService.mark_attendance(
            actor=request.user,
            student_id=student_id,
            status_value=status_value,
            attendance_date=attendance_date,
        )
        return self._attendance_result_response(result)

    @action(detail=False, methods=['post'], url_path='mark-all', throttle_classes=[BulkOperationThrottle])
    def mark_all(self, request):
        """Mark all students in a specific scope (Block/Floor/Room) with a status."""
        status_value = request.data.get('status', 'present')
        date_value = request.data.get('date')
        building_id = request.data.get('building_id')
        floor = request.data.get('floor')
        room_id = request.data.get('room_id')

        attendance_date = parse_iso_date_or_none(date_value) if date_value else date.today()

        result = AttendanceService.mark_all(
            actor=request.user,
            status_value=status_value,
            attendance_date=attendance_date,
            building_id=building_id,
            floor=floor,
            room_id=room_id,
        )
        return self._attendance_result_response(result)

    @action(detail=False, methods=['post'], url_path='lock')
    def lock_attendance(self, request):
        """Lock attendance for a specific block and date (Head Warden+ only)."""
        if not user_is_top_level_management(request.user):
            return Response({'detail': 'Only Head Warden or Admins can lock records.'}, status=status.HTTP_403_FORBIDDEN)
            
        building_id = request.data.get('building_id')
        date_value = request.data.get('date')
        attendance_date = parse_iso_date_or_none(date_value) if date_value else date.today()
        
        if not building_id:
            return Response({'detail': 'building_id is required to lock blocks.'}, status=status.HTTP_400_BAD_REQUEST)
            
        updated = Attendance.objects.filter(
            attendance_date=attendance_date,
            block_id=building_id
        ).update(is_locked=True, locked_by=request.user)
        
        return Response({'detail': f'Locked {updated} records for block {building_id} on {attendance_date}.'})

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Return attendance stats using DB-level aggregation (single query)."""
        if request.user.role == 'student':
             return Response({'detail': 'Attendance stats are restricted to management.'}, status=status.HTTP_403_FORBIDDEN)
             
        date_param = request.query_params.get('date')
        building_id_param = request.query_params.get('building_id')
        floor_param = request.query_params.get('floor')

        target_date = date.today()
        if date_param:
            parsed_date = parse_iso_date_or_none(date_param)
            if not parsed_date:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
            target_date = parsed_date

        building_id = int(building_id_param) if building_id_param else None
        floor = int(floor_param) if floor_param else None

        stats = get_attendance_stats(
            target_date,
            building_id=building_id,
            floor=floor,
            college=getattr(request.user, 'college', None),
        )
        return Response(stats)

    @action(detail=False, methods=['get'])
    def defaulters(self, request):
        """Return defaulters based on recent absences."""
        if not (user_is_admin(request.user) or user_is_staff(request.user)):
            return Response([], status=status.HTTP_200_OK)

        since = date.today() - timedelta(days=30)
        # Multi-tenant isolation (Phase 6)
        college_id = getattr(request.user, 'college_id', None)
        cf = Q(college_id=college_id) if college_id else Q()

        # FIX N+1: Use annotation to get absent_days in one query
        # LIMIT: Cap at 200 to prevent OOM on free tier
        defaulters_qs = User.objects.filter(cf & Q(role='student', is_active=True)).annotate(
            absent_days=Count(
                'attendance_records', 
                filter=Q(attendance_records__attendance_date__gte=since, attendance_records__status='absent')
            ),
            last_present_date=Max(
                'attendance_records__attendance_date',
                filter=Q(attendance_records__status='present')
            )
        ).filter(absent_days__gte=3).prefetch_related(
            Prefetch(
                'room_allocations',
                queryset=RoomAllocation.objects.filter(end_date__isnull=True).select_related('room'),
                to_attr='active_allocation'
            )
        ).order_by('-absent_days')[:200]

        payload = []
        for student in defaulters_qs:
            allocation = student.active_allocation[0] if student.active_allocation else None
            room_number = allocation.room.room_number if allocation else None

            payload.append({
                'id': student.id,
                'name': student.get_full_name() or student.username,
                'hall_ticket': student.username,
                'room_number': room_number,
                'absent_days': student.absent_days,
                'last_present': student.last_present_date,
            })

        return Response(payload)
    
    @action(detail=False, methods=['get'])
    def today(self, request):
        """Get today's attendance for current user."""
        today = date.today()
        attendance = Attendance.objects.filter(
            user=request.user,
            attendance_date=today
        ).first()
        if attendance:
            serializer = self.get_serializer(attendance)
            return Response(serializer.data)
        # Keep response successful so clients can treat "not marked yet" as empty state.
        return Response({'detail': 'No attendance record for today.'}, status=status.HTTP_200_OK)
    
    @action(detail=False, methods=['get'])
    def monthly_summary(self, request):
        """Get monthly attendance summary."""
        user_id = request.query_params.get('user_id') or str(request.user.id)
        month = request.query_params.get('month')  # YYYY-MM
        
        if not month:
            return Response({'error': 'month parameter required (YYYY-MM)'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Only privileged users (Warden, HR, Admin) can request another user's summary.
        privileged_roles = ['warden', 'head_warden', 'hr']
        is_privileged = user_is_admin(request.user) or request.user.role in privileged_roles
        
        if str(user_id) != str(request.user.id) and not is_privileged:
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        # Privileged cross-user access still must respect tenant/scope boundaries.
        if str(user_id) != str(request.user.id):
            target_user = User.objects.filter(pk=user_id).select_related('college').first()
            if not target_user:
                return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

            # Non-super-admins cannot cross college boundaries.
            if not user_is_super_admin(request.user):
                if not request.user.college_id or target_user.college_id != request.user.college_id:
                    return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

            # Warden/HR need scope access to the target user's active allocation.
            if request.user.role in ['warden', 'hr']:
                allocation = (
                    RoomAllocation.objects.filter(student_id=target_user.id, end_date__isnull=True)
                    .select_related('room')
                    .first()
                )
                if not allocation or not has_scope_access(
                    request.user,
                    building_id=getattr(allocation.room, 'building_id', None),
                    floor=getattr(allocation.room, 'floor', None),
                ):
                    return Response({'detail': 'Not authorized for this user scope.'}, status=status.HTTP_403_FORBIDDEN)
        
        year, month_num = map(int, month.split('-'))
        start_date = date(year, month_num, 1)
        if month_num == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month_num + 1, 1) - timedelta(days=1)
        
        # Aggregated stats using single query
        stats = Attendance.objects.filter(user_id=user_id, attendance_date__range=[start_date, end_date]).aggregate(
            present=Count('id', filter=Q(status='present')),
            absent=Count('id', filter=Q(status='absent')),
            on_leave=Count('id', filter=Q(status='on_leave')),
            out_gatepass=Count('id', filter=Q(status='out_gatepass')),
            late=Count('id', filter=Q(status='late')),
            total=Count('id')
        )
        
        status_count = {
            'present': stats['present'] or 0,
            'absent': stats['absent'] or 0,
            'on_leave': stats['on_leave'] or 0,
            'out_gatepass': stats['out_gatepass'] or 0,
            'late': stats['late'] or 0,
        }
        total_days = stats['total'] or 0
        
        return Response({
            'month': month,
            'total_days': total_days,
            'status_breakdown': status_count
        })

    @action(detail=False, methods=['get'], throttle_classes=[ExportRateThrottle])
    def export_csv(self, request):
        """Export attendance records to CSV.

        Heavy operation: streams up to 10,000 rows.  Protected by ExportRateThrottle
        (2 req/min) so it cannot block WebSocket workers on the free-tier server.
        """
        import csv

        # Verify permissions
        user = request.user
        if not (user_is_admin(user) or user.role in ['warden', 'head_warden']):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        # Get records filtered by date/role using helper logic or manually
        queryset = Attendance.objects.all().select_related('user')
        
        # Apply date filter
        date_param = self.request.query_params.get('date')
        if date_param:
            target_date = parse_iso_date_or_none(date_param)
            if target_date:
                queryset = queryset.filter(attendance_date=target_date)
        
        # Limit rows
        queryset = queryset.order_by('-attendance_date')[:5000]

        # Use StreamingHttpResponse for memory safety
        class Echo:
            def write(self, value):
                return value

        # Pre-fetch room allocations for efficiency
        student_ids = list(queryset.values_list('user_id', flat=True))
        allocations = RoomAllocation.objects.filter(
            student_id__in=student_ids, 
            end_date__isnull=True
        ).select_related('room')
        room_map = {alloc.student_id: alloc.room.room_number for alloc in allocations}

        def stream_attendance():
            buffer = Echo()
            writer = csv.writer(buffer)
            yield writer.writerow(['Date', 'Student Name', 'Register No', 'Status', 'Room', 'Updated At'])
            
            # OPTIMIZED: Use values() and iterator() to zero model instantiation and RAM usage
            data_qs = queryset.values(
                'attendance_date', 'status', 'updated_at', 'user_id',
                'user__first_name', 'user__last_name', 'user__username', 'user__registration_number'
            )
            
            for row in data_qs.iterator(chunk_size=500):
                name = f"{row['user__first_name']} {row['user__last_name']}".strip() or row['user__username']
                yield writer.writerow([
                    row['attendance_date'],
                    name,
                    row['user__registration_number'],
                    row['status'],
                    room_map.get(row['user_id'], ''),
                    row['updated_at'].strftime("%H:%M:%S") if row['updated_at'] else ''
                ])

        response = StreamingHttpResponse(stream_attendance(), content_type='text/csv')
        filename = f"attendance_{date_param if date_param else 'all'}_{timezone.now().strftime('%Y%m%d')}.csv"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class AttendanceReportViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for Attendance Reports."""
    
    queryset = AttendanceReport.objects.all()
    serializer_class = AttendanceReportSerializer
    
    def get_permissions(self):
        return [IsAuthenticated(), (IsAdmin | IsWarden)()]
    
    def get_queryset(self):
        """Filter reports based on user role and authority."""
        user = self.request.user
        qs = super().get_queryset()
        privileged_roles = ['warden', 'head_warden', 'hr']
        if user_is_admin(user) or user.role in privileged_roles:
            return qs
        return qs.filter(user=user)
    
    @action(detail=False, methods=['post'])
    def generate_report(self, request):
        """Generate attendance report for a user."""
        user_id = request.data.get('user_id')
        period = request.data.get('period', 'monthly')
        
        if not user_id:
            return Response({'error': 'user_id required'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        if request.user.role == 'student':
            if str(user_id) != str(request.user.id):
                return Response({'detail': 'You can only generate your own attendance report.'}, status=status.HTTP_403_FORBIDDEN)
            target_user_queryset = User.objects.filter(pk=request.user.pk)
        elif user_is_super_admin(request.user):
            target_user_queryset = User.objects.all()
        else:
            college = getattr(request.user, 'college', None)
            if college is None:
                return Response({'detail': 'Your account is not assigned to a college.'}, status=status.HTTP_403_FORBIDDEN)
            target_user_queryset = User.objects.filter(college=college)

        target_user = get_object_or_404(target_user_queryset, pk=user_id)
        
        # Calculate date range
        today = date.today()
        if period == 'weekly':
            start_date = today - timedelta(days=today.weekday())
            end_date = start_date + timedelta(days=6)
        elif period == 'monthly':
            start_date = date(today.year, today.month, 1)
            if today.month == 12:
                end_date = date(today.year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = date(today.year, today.month + 1, 1) - timedelta(days=1)
        else:
            start_date = today
            end_date = today
        
        # Get attendance records
        records = Attendance.objects.filter(
            user=target_user,
            attendance_date__range=[start_date, end_date]
        )
        
        # Calculate stats via DB aggregation
        stats = records.values('status').annotate(count=Count('id'))
        status_counts = {s['status']: s['count'] for s in stats}
        total_days = sum(status_counts.values())
        
        percentage = (status_counts.get('present', 0) / total_days * 100) if total_days > 0 else 0
        
        # Create or update report
        report, _ = AttendanceReport.objects.update_or_create(
            user=target_user,
            period=period,
            start_date=start_date,
            end_date=end_date,
            defaults={
                'college': target_user.college,
                'tenant_id': str(target_user.college_id) if target_user.college_id else None,
                'total_days': total_days,
                'present_days': status_counts.get('present', 0),
                'absent_days': status_counts.get('absent', 0),
                'late_days': status_counts.get('late', 0),
                'excused_days': status_counts.get('excused', 0),
                'percentage': percentage
            }
        )
        
        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
