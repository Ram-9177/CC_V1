"""Attendance viewsets and views."""

from rest_framework import viewsets, status
from django.db.models import Prefetch, Count, Q, Max
from django.db import transaction
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import (
    IsWarden, IsAdmin, user_is_admin, user_is_staff, 
    STAFF_ROLES
)
from core.date_utils import parse_iso_date_or_none
from core.role_scopes import get_warden_building_ids, user_is_top_level_management
from django.utils import timezone
from datetime import timedelta, date
from .models import Attendance, AttendanceReport
from .serializers import AttendanceSerializer, AttendanceReportSerializer
from apps.auth.models import User
from apps.rooms.models import RoomAllocation
from websockets.broadcast import broadcast_to_management, broadcast_to_role, broadcast_to_updates_user


class AttendanceViewSet(viewsets.ModelViewSet):
    """ViewSet for Attendance management."""
    
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            # Only admins and wardens can modify attendance
            return [IsAuthenticated(), (IsAdmin | IsWarden)()]
        else:
            # All authenticated users can read
            return [IsAuthenticated()]
    
    def get_queryset(self):
        """Filter queryset based on user role and ownership."""
        user = self.request.user
        queryset = Attendance.objects.all()

        date_param = self.request.query_params.get('date')
        target_date = parse_iso_date_or_none(date_param)
        if target_date:
            queryset = queryset.filter(attendance_date=target_date)

        # 1. Admin, Super Admin, Head Warden see all
        if user_is_top_level_management(user) or user.role == 'chef':
            return queryset
        
        # 2. Warden: See attendance from students in their assigned blocks
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            if not warden_buildings.exists():
                return queryset
            return queryset.filter(
                user__room_allocations__room__building_id__in=warden_buildings,
                user__room_allocations__end_date__isnull=True
            ).distinct()

        # 3. Staff/Other: Default to self
        return queryset.filter(user=user)

    def list(self, request, *args, **kwargs):
        """Return attendance records with student details for a date.
        OPTIMIZED: Prevents loading 2000+ full User objects into RAM.
        """
        from django.db.models import Q
        from apps.gate_passes.models import GatePass
        from datetime import datetime

        user = request.user
        date_param = request.query_params.get('date')
        target_date = date.today()

        if date_param:
            parsed_date = parse_iso_date_or_none(date_param)
            if not parsed_date:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
            target_date = parsed_date

        if user.role in STAFF_ROLES or user.role == 'chef':
            # LIMIT: Prevents OOM by prioritizing filtered data or limiting result sets
            students_qs = User.objects.filter(role='student', is_active=True)
            
            building_id = request.query_params.get('building_id')
            floor = request.query_params.get('floor')
            
            # Application of Warden Block Restriction
            if user.role == 'warden' and not building_id:
                warden_buildings = get_warden_building_ids(user)
                students_qs = students_qs.filter(room_allocations__room__building_id__in=warden_buildings, room_allocations__end_date__isnull=True)
            elif building_id:
                students_qs = students_qs.filter(room_allocations__room__building_id=building_id, room_allocations__end_date__isnull=True)
            elif floor:
                students_qs = students_qs.filter(room_allocations__room__floor=floor, room_allocations__end_date__isnull=True)
            
            # Final fallback/safety limit
            if not building_id and user_is_top_level_management(user):
                students_qs = students_qs[:300]

            students = students_qs.prefetch_related(
                Prefetch(
                    'room_allocations',
                    queryset=RoomAllocation.objects.filter(end_date__isnull=True).select_related('room'),
                    to_attr='active_allocation'
                )
            )
            
            # Use values() to avoid heavy Model creation
            records = Attendance.objects.filter(attendance_date=target_date).values('user_id', 'id', 'status', 'updated_at')
            record_map = {r['user_id']: r for r in records}

            start_of_day = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_of_day = datetime.combine(target_date, datetime.max.time()).replace(tzinfo=timezone.utc)

            active_passes = GatePass.objects.filter(
                Q(status='approved') | Q(status='used'),
                exit_date__lte=end_of_day
            ).filter(
                Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
            ).values('student_id', 'pass_type', 'status', 'exit_date', 'entry_date')
            
            pass_map = {p['student_id']: p for p in active_passes}

            payload = []
            for student in students:
                record = record_map.get(student.id)
                allocation = student.active_allocation[0] if student.active_allocation else None
                room_number = allocation.room.room_number if allocation else None
                gate_pass = pass_map.get(student.id)
                
                payload.append({
                    'id': record['id'] if record else student.id,
                    'student': {
                        'id': student.id,
                        'name': student.get_full_name() or student.username,
                        'hall_ticket': student.username,
                        'room_number': room_number,
                    },
                    'date': target_date.isoformat(),
                    'status': record['status'] if record else 'absent',
                    'gate_pass': gate_pass,
                    'marked_at': record['updated_at'] if record else None,
                })

            return Response(payload)

        # Student personal view
        records = Attendance.objects.filter(user=user, attendance_date=target_date)
        serializer = self.get_serializer(records, many=True)
        return Response(serializer.data)

        records = Attendance.objects.filter(user=user, attendance_date=target_date)
        serializer = self.get_serializer(records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def mark(self, request):
        """Mark attendance for a student and date."""
        student_id = request.data.get('student_id')
        status_value = request.data.get('status')
        date_value = request.data.get('date')

        if not student_id or not status_value:
            return Response({'detail': 'student_id and status are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # SECURITY FIX: Only staff can mark. Removed self-marking loophole.
        if not (user_is_admin(request.user) or user_is_staff(request.user) or request.user.groups.filter(name='Student_HR').exists()):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        attendance_date = parse_iso_date_or_none(date_value) if date_value else date.today()
        if date_value and not attendance_date:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if status_value not in ['present', 'absent', 'late', 'excused', 'sick']:
            return Response({'detail': 'Invalid status value.'}, status=status.HTTP_400_BAD_REQUEST)

        # GATE PASS CHECK: If student is marked "present" but has an active gate pass, block it.
        if status_value == 'present':
            from apps.gate_passes.models import GatePass
            from datetime import datetime
            import pytz
            
            start_of_day = datetime.combine(attendance_date, datetime.min.time()).replace(tzinfo=pytz.UTC)
            end_of_day = datetime.combine(attendance_date, datetime.max.time()).replace(tzinfo=pytz.UTC)

            active_pass = GatePass.objects.filter(
                student_id=student_id,
                status__in=['approved', 'used'],
                exit_date__lte=end_of_day
            ).filter(
                Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
            ).exists()

            if active_pass:
                return Response({
                    'detail': 'Cannot mark student as present. This student has an active Gate Pass (Out).',
                    'code': 'STUDENT_OUT'
                }, status=status.HTTP_400_BAD_REQUEST)

        record, _ = Attendance.objects.update_or_create(
            user_id=student_id,
            attendance_date=attendance_date,
            defaults={'status': status_value}
        )

        # DEFER BROADCASTS: Only send after DB commit to avoid race conditions
        def send_updates():
            # Real-time updates for dashboards and student view.
            broadcast_to_updates_user(int(student_id), 'attendance_updated', {
                'user_id': int(student_id),
                'date': attendance_date.isoformat(),
                'status': status_value,
                'resource': 'attendance',
            })
            for role in ['staff', 'admin', 'super_admin', 'warden', 'head_warden']:
                broadcast_to_role(role, 'attendance_updated', {
                    'user_id': int(student_id),
                    'date': attendance_date.isoformat(),
                    'status': status_value,
                    'resource': 'attendance',
                })
        
        transaction.on_commit(send_updates)

        serializer = self.get_serializer(record)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mark-all')
    def mark_all(self, request):
        """Mark all students with a status for a date."""
        if not (user_is_admin(request.user) or user_is_staff(request.user) or request.user.groups.filter(name='Student_HR').exists()):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        status_value = request.data.get('status', 'present')
        date_value = request.data.get('date')

        if status_value not in ['present', 'absent', 'late', 'excused', 'sick']:
            return Response({'detail': 'Invalid status value.'}, status=status.HTTP_400_BAD_REQUEST)

        attendance_date = parse_iso_date_or_none(date_value) if date_value else date.today()
        if date_value and not attendance_date:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        
        # Base queryset
        students = User.objects.filter(role='student', is_active=True)
        
        # Granular Filters
        room_id = request.data.get('room_id')
        building_id = request.data.get('building_id')
        floor = request.data.get('floor')
        
        if room_id:
            students = students.filter(
                room_allocations__room_id=room_id,
                room_allocations__end_date__isnull=True,
                room_allocations__status='approved'
            )
        elif building_id:
            # Filter by building (and optional floor)
            if floor:
                students = students.filter(
                    room_allocations__room__building_id=building_id,
                    room_allocations__room__floor=floor,
                    room_allocations__end_date__isnull=True,
                    room_allocations__status='approved'
                )
            else:
                students = students.filter(
                    room_allocations__room__building_id=building_id,
                    room_allocations__end_date__isnull=True,
                    room_allocations__status='approved'
                )
        
        # Optimization: distinct() in case multiple allocations (shouldn't happen with constraints but safe)
        students = students.distinct()
        
        # MEMORY FIX: Don't load full User objects. Use IDs.
        student_ids = list(students.values_list('id', flat=True))

        # GATE PASS EXCLUSION: If marking everyone "present", exclude those who are "Out"
        if status_value == 'present':
            from apps.gate_passes.models import GatePass
            from datetime import datetime
            import pytz
            
            start_of_day = datetime.combine(attendance_date, datetime.min.time()).replace(tzinfo=pytz.UTC)
            end_of_day = datetime.combine(attendance_date, datetime.max.time()).replace(tzinfo=pytz.UTC)

            students_with_passes = GatePass.objects.filter(
                student_id__in=student_ids,
                status__in=['approved', 'used'],
                exit_date__lte=end_of_day
            ).filter(
                Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
            ).values_list('student_id', flat=True)

            out_student_ids = set(students_with_passes)
            
            # Create "present" for non-out students
            records_to_create = [
                Attendance(user_id=sid, attendance_date=attendance_date, status='present')
                for sid in student_ids if sid not in out_student_ids
            ]
            
            # Ensure "out" students are marked "absent" (default absent rule)
            out_records = [
                Attendance(user_id=sid, attendance_date=attendance_date, status='absent')
                for sid in student_ids if sid in out_student_ids
            ]
            records_to_create.extend(out_records)
        else:
            records_to_create = [
                Attendance(user_id=sid, attendance_date=attendance_date, status=status_value)
                for sid in student_ids
            ]
        
        # FIX: Use bulk_create with update_conflicts for 1 query instead of 1000.
        with transaction.atomic():
            Attendance.objects.bulk_create(
                records_to_create,
                batch_size=500, # MEMORY SAFETY
                update_conflicts=True,
                unique_fields=['user', 'attendance_date'],
                update_fields=['status']
            )

        # Broadcast a single event so dashboards can refresh.
        def send_bulk_updates():
            # Broadcast to management only (prevent thundering herd on student devices).
            # Students will see updated status on next natural app open/refresh.
            broadcast_to_management('attendance_updated', {
                'date': attendance_date.isoformat(),
                'status': status_value,
                'resource': 'attendance',
            })
            
        transaction.on_commit(send_bulk_updates)

        return Response({'detail': 'Attendance marked for all students.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Return attendance stats for a date."""
        from django.db.models import Count, Q
        
        date_param = request.query_params.get('date')
        target_date = date.today()
        if date_param:
            parsed_date = parse_iso_date_or_none(date_param)
            if not parsed_date:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
            target_date = parsed_date

        counts = Attendance.objects.filter(attendance_date=target_date).aggregate(
            present=Count('id', filter=Q(status='present')),
            absent=Count('id', filter=Q(status='absent'))
        )
        
        total_students = User.objects.filter(role='student', is_active=True).count()
        present_today = counts['present']
        absent_today = counts['absent']
        percentage = (present_today / total_students * 100) if total_students else 0

        return Response({
            'total_students': total_students,
            'present_today': present_today,
            'absent_today': absent_today,
            'attendance_percentage': round(percentage, 2),
        })

    @action(detail=False, methods=['get'])
    def defaulters(self, request):
        """Return defaulters based on recent absences."""
        if not (user_is_admin(request.user) or user_is_staff(request.user)):
            return Response([], status=status.HTTP_200_OK)

        from django.db.models import Count, Q, Max, Prefetch
        from apps.rooms.models import RoomAllocation
        
        since = date.today() - timedelta(days=30)
        
        # FIX N+1: Use annotation to get absent_days in one query
        # LIMIT: Cap at 200 to prevent OOM on free tier
        defaulters_qs = User.objects.filter(role='student', is_active=True).annotate(
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

        # Only privileged users can request another user's summary.
        if str(user_id) != str(request.user.id) and not (user_is_admin(request.user) or user_is_staff(request.user)):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        
        year, month_num = map(int, month.split('-'))
        start_date = date(year, month_num, 1)
        if month_num == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month_num + 1, 1) - timedelta(days=1)
        
        from django.db.models import Count
        records_summary = Attendance.objects.filter(
            user_id=user_id,
            attendance_date__range=[start_date, end_date]
        ).values('status').annotate(count=Count('id'))
        
        status_count = {s['status']: s['count'] for s in records_summary}
        total_days = sum(status_count.values())
        
        return Response({
            'month': month,
            'total_days': total_days,
            'status_breakdown': status_count
        })

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Export attendance records to CSV."""
        import csv
        from django.http import HttpResponse

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
        from django.http import StreamingHttpResponse

        class Echo:
            def write(self, value):
                return value

        # Pre-fetch room allocations for efficiency
        student_ids = [att.user_id for att in queryset]
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
    permission_classes = [IsAuthenticated, IsAdmin | IsWarden]
    
    def get_queryset(self):
        """Filter reports based on user role."""
        user = self.request.user
        if user_is_admin(user) or user_is_staff(user):
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
