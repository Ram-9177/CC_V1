"""Attendance viewsets and views."""

from rest_framework import viewsets, status
from django.db.models import Count, Q, Max, Prefetch
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import (
    IsWarden, IsAdmin, user_is_admin, user_is_staff, 
    STAFF_ROLES, IsHR, user_is_hr
)
from core.college_mixin import CollegeScopeMixin
from core.date_utils import parse_iso_date_or_none
from core.role_scopes import (
    get_warden_building_ids, user_is_top_level_management,
    get_hr_building_ids, get_hr_floor_numbers, has_scope_access
)
from datetime import timedelta, date, datetime
import pytz
from django.utils import timezone
from .models import Attendance, AttendanceReport
from .serializers import AttendanceSerializer, AttendanceReportSerializer
from apps.auth.models import User
from apps.rooms.models import RoomAllocation
from apps.gate_passes.models import GatePass
from websockets.broadcast import broadcast_to_management
from core.throttles import BulkOperationThrottle, ExportRateThrottle
from core.services import broadcast_forecast_refresh, broadcast_attendance_event, get_attendance_stats
from django.http import StreamingHttpResponse


class AttendanceViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for Attendance management."""
    
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'mark', 'mark_all']:
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
                status__in=['approved', 'used'],
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
            records = Attendance.objects.filter(user=user, attendance_date=target_date)
            serializer = self.get_serializer(records, many=True)
            return Response(serializer.data)

        # Fallback for other non-staff roles
        return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=False, methods=['post'])
    def sync_missing_records(self, request):
        """Backfill missing attendance records for a specific date."""
        # 1. Get date
        target_date_str = request.data.get('date')
        target_date = parse_iso_date_or_none(target_date_str) or date.today()
        
        # 2. Bulk Logic
        with transaction.atomic():
            # 1. Base Query: Only active students (college-scoped)
            college = getattr(request.user, 'college', None)
            cf = Q(college=college) if college else Q()
            all_students = User.objects.filter(cf & Q(role='student', is_active=True)).only('id', 'username', 'registration_number')
            
            # 2. Add GatePass status overlay
            active_gps = GatePass.objects.filter(
                status='approved',
                exit_date__lte=timezone.now(),
            ).filter(
                Q(entry_date__gte=timezone.now()) | Q(entry_date__isnull=True)
            ).values_list('student_id', flat=True)

            # 3. Existing attendance records for the day
            existing_attendance_ids = Attendance.objects.filter(
                attendance_date=target_date
            ).values_list('user_id', flat=True)

            # 4. Identify students without attendance records
            students_without_attendance = all_students.exclude(id__in=existing_attendance_ids)

            records_to_create = []
            for student in students_without_attendance:
                status_value = 'out_gatepass' if student.id in active_gps else 'absent'
                
                # Try to get room allocation for block/floor info
                active_alloc = RoomAllocation.objects.filter(student=student, end_date__isnull=True).select_related('room').first()
                block_id = active_alloc.room.building_id if active_alloc else None
                floor = active_alloc.room.floor if active_alloc else None

                records_to_create.append(
                    Attendance(
                        user_id=student.id,
                        attendance_date=target_date,
                        status=status_value,
                        block_id=block_id,
                        floor=floor
                    )
                )
            
            if records_to_create:
                Attendance.objects.bulk_create(records_to_create, batch_size=500)

            # 5. Broadcast + Forecast Cache Invalidation
            broadcast_forecast_refresh(target_date)

            return Response({'detail': f'Sync complete. {len(records_to_create)} records created.'})

    @action(detail=False, methods=['post'])
    def mark(self, request):
        """Mark attendance for a student and date with hierarchical locking enforcement."""
        student_id = request.data.get('student_id')
        status_value = request.data.get('status')
        date_value = request.data.get('date')

        if not student_id or not status_value:
            return Response({'detail': 'student_id and status are required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        attendance_date = parse_iso_date_or_none(date_value) if date_value else date.today()
        
        # 1. Fetch student and allocation to verify scope
        try:
            student = User.objects.get(id=student_id)
            active_alloc = RoomAllocation.objects.filter(student=student, end_date__isnull=True).select_related('room').first()
            if not active_alloc:
                return Response({'detail': 'Student has no active room allocation.'}, status=status.HTTP_400_BAD_REQUEST)
            
            building_id = active_alloc.room.building_id
            floor = active_alloc.room.floor
        except User.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        # 2. Scope & Hierarchy Validation
        if not has_scope_access(user, building_id=building_id, floor=floor):
            return Response({'detail': 'Insufficient authority to mark attendance for this student or area.'}, status=status.HTTP_403_FORBIDDEN)

        # 3. Valid status check
        valid_statuses = [s[0] for s in Attendance.STATUS_CHOICES]
        if status_value not in valid_statuses:
            return Response({'detail': f'Invalid status. Allowed: {", ".join(valid_statuses)}'}, status=status.HTTP_400_BAD_REQUEST)

        # 4. Locking check
        existing_record = Attendance.objects.filter(user_id=student_id, attendance_date=attendance_date).first()
        if existing_record and existing_record.is_locked:
            if not user_is_top_level_management(user):
                 return Response({'detail': 'Attendance is locked. Contact Head Warden or Admin to modify.'}, status=status.HTTP_403_FORBIDDEN)

        # 5. Gate Pass Check (Enforcement)
        if status_value == 'present':
            start_of_day = datetime.combine(attendance_date, datetime.min.time()).replace(tzinfo=pytz.UTC)
            end_of_day = datetime.combine(attendance_date, datetime.max.time()).replace(tzinfo=pytz.UTC)

            if GatePass.objects.filter(
                student_id=student_id,
                status__in=['approved', 'used', 'checked_out'],
                exit_date__lte=end_of_day
            ).filter(
                Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
            ).exists():
                return Response({
                    'detail': 'Student is currently OUT on an active Gate Pass.',
                    'code': 'STUDENT_OUT'
                }, status=status.HTTP_400_BAD_REQUEST)

        # 6. Mark / Update
        record, _ = Attendance.objects.update_or_create(
            user_id=student_id,
            attendance_date=attendance_date,
            defaults={
                'status': status_value,
                'block_id': building_id,
                'floor': floor,
            }
        )

        # 7. Broadcasts + Forecast Cache Invalidation
        broadcast_attendance_event(int(student_id), attendance_date, status_value, building_id)
        broadcast_forecast_refresh(attendance_date)

        serializer = self.get_serializer(record)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mark-all', throttle_classes=[BulkOperationThrottle])
    def mark_all(self, request):
        """Mark all students in a specific scope (Block/Floor) with a status."""
        user = request.user
        status_value = request.data.get('status', 'present')
        date_value = request.data.get('date')
        building_id = request.data.get('building_id')
        floor = request.data.get('floor')

        attendance_date = parse_iso_date_or_none(date_value) if date_value else date.today()
        
        # 1. Authority Check
        if not has_scope_access(user, building_id=building_id, floor=floor):
            return Response({'detail': 'Not authorized to perform bulk actions in this scope.'}, status=status.HTTP_403_FORBIDDEN)

        # 2. Locking check for the whole set
        if Attendance.objects.filter(attendance_date=attendance_date, block_id=building_id, is_locked=True).exists():
            if not user_is_top_level_management(user):
                return Response({'detail': 'Attendance in this block is locked for the selected date.'}, status=status.HTTP_403_FORBIDDEN)

        # 3. Target Students Query (college-scoped)
        college = getattr(user, 'college', None)
        cf = Q(college=college) if college else Q()
        students = User.objects.filter(cf & Q(role='student', is_active=True))
        if building_id:
            students = students.filter(room_allocations__room__building_id=building_id, room_allocations__end_date__isnull=True)
        if floor:
            students = students.filter(room_allocations__room__floor=floor, room_allocations__end_date__isnull=True)
        
        student_ids = list(students.distinct().values_list('id', flat=True))
        if not student_ids:
             return Response({'detail': 'No students found in the specified scope.'}, status=status.HTTP_404_NOT_FOUND)

        # 4. Gate Pass Logic (Exclusion)
        out_student_ids = set()
        if status_value == 'present':
            start_of_day = datetime.combine(attendance_date, datetime.min.time()).replace(tzinfo=pytz.UTC)
            end_of_day = datetime.combine(attendance_date, datetime.max.time()).replace(tzinfo=pytz.UTC)

            out_student_ids = set(GatePass.objects.filter(
                student_id__in=student_ids,
                status__in=['approved', 'used', 'checked_out'],
                exit_date__lte=end_of_day
            ).filter(
                Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
            ).values_list('student_id', flat=True))

        # 5. Bulk Operation
        records_to_create = []
        for sid in student_ids:
            # If student is out on gatepass, they are marked 'out_gatepass' by default if status is present
            effective_status = status_value
            if sid in out_student_ids and status_value == 'present':
                effective_status = 'out_gatepass'
            
            records_to_create.append(
                Attendance(
                    user_id=sid, 
                    attendance_date=attendance_date, 
                    status=effective_status,
                    block_id=building_id,
                    floor=floor
                )
            )

        with transaction.atomic():
            Attendance.objects.bulk_create(
                records_to_create,
                batch_size=500,
                update_conflicts=True,
                unique_fields=['user', 'attendance_date'],
                update_fields=['status', 'block_id', 'floor']
            )

        # 6. Broadcast + Forecast Cache Invalidation (single Redis call)
        def send_bulk_updates():
            broadcast_to_management('attendance_updated', {
                'date': attendance_date.isoformat(),
                'status': status_value,
                'building_id': building_id,
                'floor': floor,
                'count': len(student_ids),
                'resource': 'attendance',
            })

        transaction.on_commit(send_bulk_updates)
        broadcast_forecast_refresh(attendance_date)

        return Response({'detail': f'Attendance marked for {len(student_ids)} students.'}, status=status.HTTP_200_OK)

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

        stats = get_attendance_stats(target_date, building_id=building_id, floor=floor)
        return Response(stats)

    @action(detail=False, methods=['get'])
    def defaulters(self, request):
        """Return defaulters based on recent absences."""
        if not (user_is_admin(request.user) or user_is_staff(request.user)):
            return Response([], status=status.HTTP_200_OK)

        since = date.today() - timedelta(days=30)
        college = getattr(request.user, 'college', None)
        cf = Q(college=college) if college else Q()

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
        return Response({'detail': 'No attendance record for today.'}, 
                        status=status.HTTP_404_NOT_FOUND)
    
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


class AttendanceReportViewSet(viewsets.ModelViewSet):
    """ViewSet for Attendance Reports."""
    
    queryset = AttendanceReport.objects.all()
    serializer_class = AttendanceReportSerializer
    
    def get_permissions(self):
        return [IsAuthenticated(), (IsAdmin | IsWarden)()]
    
    def get_queryset(self):
        """Filter reports based on user role and authority."""
        user = self.request.user
        privileged_roles = ['warden', 'head_warden', 'hr']
        if user_is_admin(user) or user.role in privileged_roles:
            return AttendanceReport.objects.all()
        return AttendanceReport.objects.filter(user=user)
    
    @action(detail=False, methods=['post'])
    def generate_report(self, request):
        """Generate attendance report for a user."""
        user_id = request.data.get('user_id')
        period = request.data.get('period', 'monthly')
        
        if not user_id:
            return Response({'error': 'user_id required'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        # STRICT ROLE CHECK: Students can only generate reports for themselves
        if request.user.role == 'student' and str(user_id) != str(request.user.id):
            return Response({'detail': 'You can only generate your own attendance report.'}, status=status.HTTP_403_FORBIDDEN)
        
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
            user_id=user_id,
            attendance_date__range=[start_date, end_date]
        )
        
        # Calculate stats via DB aggregation
        stats = records.values('status').annotate(count=Count('id'))
        status_counts = {s['status']: s['count'] for s in stats}
        total_days = sum(status_counts.values())
        
        percentage = (status_counts.get('present', 0) / total_days * 100) if total_days > 0 else 0
        
        # Create or update report
        report, _ = AttendanceReport.objects.update_or_create(
            user_id=user_id,
            period=period,
            start_date=start_date,
            end_date=end_date,
            defaults={
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
