"""Attendance viewsets and views."""

from rest_framework import viewsets, status
from django.db.models import Prefetch
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import (
    IsWarden, IsAdmin, user_is_admin, user_is_staff, 
    STAFF_ROLES, ROLE_STUDENT
)
from django.utils import timezone
from datetime import timedelta, date
from .models import Attendance, AttendanceReport
from .serializers import AttendanceSerializer, AttendanceReportSerializer
from apps.auth.models import User
from apps.rooms.models import RoomAllocation
from websockets.broadcast import broadcast_to_role, broadcast_to_updates_user


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
        if date_param:
            try:
                queryset = queryset.filter(attendance_date=date.fromisoformat(date_param))
            except ValueError:
                pass

        # Staff and admins see all attendance records
        if user.role in STAFF_ROLES:
            return queryset
        
        # Students see only their own attendance
        elif user.role == ROLE_STUDENT:
            return queryset.filter(user=user)
        
        # Default: see own records
        else:
            return queryset.filter(user=user)

    def list(self, request, *args, **kwargs):
        """Return attendance records with student details for a date."""
        from django.db.models import Q
        from apps.gate_passes.models import GatePass
        from datetime import datetime

        user = request.user
        date_param = request.query_params.get('date')
        target_date = date.today()

        if date_param:
            try:
                target_date = date.fromisoformat(date_param)
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if user.role in STAFF_ROLES or user.role == 'chef':
            # FIX N+1: Prefetch room allocations
            students = User.objects.filter(role='student').prefetch_related(
                Prefetch(
                    'room_allocations',
                    queryset=RoomAllocation.objects.filter(end_date__isnull=True).select_related('room'),
                    to_attr='active_allocation'
                )
            )
            records = Attendance.objects.filter(attendance_date=target_date)
            record_map = {record.user_id: record for record in records}

            # Fetch active gate passes for the date
            # Logic: Pass is valid if it overlaps with target_date
            # active if: (exit <= target_end) AND (entry >= target_start OR entry is NULL)
            # using date comparison for simplicity
            
            # Start/End of target date
            start_of_day = datetime.combine(target_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_of_day = datetime.combine(target_date, datetime.max.time()).replace(tzinfo=timezone.utc)

            active_passes = GatePass.objects.filter(
                Q(status='approved') | Q(status='used'),
                exit_date__lte=end_of_day
            ).filter(
                Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
            )
            
            pass_map = {
                p.student_id: {
                    'type': p.pass_type,
                    'status': p.status,
                    'exit': p.exit_date,
                    'entry': p.entry_date
                } 
                for p in active_passes
            }

            payload = []
            for student in students:
                record = record_map.get(student.id)
                allocation = student.active_allocation[0] if student.active_allocation else None
                room_number = allocation.room.room_number if allocation else None
                
                # Check gate pass
                gate_pass = pass_map.get(student.id)
                
                # If student is 'out' on gate pass, they are effectively 'absent' from hostel,
                # but we can distinguish this in the UI.
                
                payload.append({
                    'id': record.id if record else student.id,
                    'student': {
                        'id': student.id,
                        'name': student.get_full_name() or student.username,
                        'hall_ticket': student.username,
                        'room_number': room_number,
                    },
                    'date': target_date.isoformat(),
                    'status': record.status if record else 'absent',
                    'gate_pass': gate_pass, # Add gate pass info
                    'marked_by': None,
                    'marked_at': record.updated_at if record else None,
                })

            return Response(payload)

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

        if not (user_is_admin(request.user) or user_is_staff(request.user)) and request.user.id != int(student_id):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            attendance_date = date.fromisoformat(date_value) if date_value else date.today()
        except ValueError:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if status_value not in ['present', 'absent', 'late', 'excused', 'sick']:
            return Response({'detail': 'Invalid status value.'}, status=status.HTTP_400_BAD_REQUEST)

        record, _ = Attendance.objects.update_or_create(
            user_id=student_id,
            attendance_date=attendance_date,
            defaults={'status': status_value}
        )

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

        serializer = self.get_serializer(record)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='mark-all')
    def mark_all(self, request):
        """Mark all students with a status for a date."""
        if not (user_is_admin(request.user) or user_is_staff(request.user)):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        status_value = request.data.get('status', 'present')
        date_value = request.data.get('date')

        if status_value not in ['present', 'absent', 'late', 'excused', 'sick']:
            return Response({'detail': 'Invalid status value.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            attendance_date = date.fromisoformat(date_value) if date_value else date.today()
        except ValueError:
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
        
        records_to_create = [
            Attendance(user=student, attendance_date=attendance_date, status=status_value)
            for student in students
        ]
        
        # FIX: Use bulk_create with update_conflicts for 1 query instead of 1000.
        with transaction.atomic():
            Attendance.objects.bulk_create(
                records_to_create,
                update_conflicts=True,
                unique_fields=['user', 'attendance_date'],
                update_fields=['status']
            )

        # Broadcast a single event so dashboards can refresh.
        for role in ['staff', 'admin', 'super_admin', 'warden', 'head_warden']:
            broadcast_to_role(role, 'attendance_updated', {
                'date': attendance_date.isoformat(),
                'status': status_value,
                'resource': 'attendance',
            })

        # Students refresh their own widgets (today/month summary) on bulk mark.
        broadcast_to_role('student', 'attendance_updated', {
            'date': attendance_date.isoformat(),
            'status': status_value,
            'resource': 'attendance',
        })

        return Response({'detail': 'Attendance marked for all students.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Return attendance stats for a date."""
        from django.db.models import Count, Q
        
        date_param = request.query_params.get('date')
        target_date = date.today()
        if date_param:
            try:
                target_date = date.fromisoformat(date_param)
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

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
        )

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
        
        records = Attendance.objects.filter(
            user_id=user_id,
            attendance_date__range=[start_date, end_date]
        )
        
        status_count = {}
        for record in records:
            status_count[record.status] = status_count.get(record.status, 0) + 1
        
        return Response({
            'month': month,
            'total_days': records.count(),
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
            try:
                target_date = date.fromisoformat(date_param)
                queryset = queryset.filter(attendance_date=target_date)
            except ValueError:
                pass
        
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
            
            # Use iterator/chunking for memory efficiency
            # Note: queryset.iterator() doesn't support select_related in some Django versions
            # but here queryset is already a result of filtering.
            for record in queryset.iterator(chunk_size=500):
                # We need room allocations. Best to pre-fetch or join.
                # Since we are streaming, we'll use a simple cache or subquery earlier.
                # For now, optimization: use the room_map from pre-fetched allocations.
                student = record.user
                yield writer.writerow([
                    record.attendance_date,
                    student.get_full_name() or student.username,
                    student.registration_number,
                    record.status,
                    room_map.get(student.id, ''),
                    record.updated_at.strftime("%H:%M:%S")
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
        
        # Calculate stats
        total_days = records.count()
        status_counts = {}
        for record in records:
            status_counts[record.status] = status_counts.get(record.status, 0) + 1
        
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
