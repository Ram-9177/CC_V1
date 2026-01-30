"""Attendance viewsets and views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsWarden, IsAdmin, user_is_admin, user_is_staff
from django.utils import timezone
from datetime import timedelta, date
from .models import Attendance, AttendanceReport
from .serializers import AttendanceSerializer, AttendanceReportSerializer
from apps.auth.models import User
from apps.rooms.models import RoomAllocation


class AttendanceViewSet(viewsets.ModelViewSet):
    """ViewSet for Attendance management."""
    
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Set permissions based on action."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdmin | IsWarden]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]
    
    def get_queryset(self):
        """Filter queryset based on user role."""
        user = self.request.user
        queryset = Attendance.objects.all()

        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                queryset = queryset.filter(attendance_date=date.fromisoformat(date_param))
            except ValueError:
                pass

        if user_is_admin(user) or user_is_staff(user):
            return queryset
        return queryset.filter(user=user)

    def list(self, request, *args, **kwargs):
        """Return attendance records with student details for a date."""
        user = request.user
        date_param = request.query_params.get('date')
        target_date = date.today()

        if date_param:
            try:
                target_date = date.fromisoformat(date_param)
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if user_is_admin(user) or user_is_staff(user):
            students = User.objects.filter(groups__name='Student')
            records = Attendance.objects.filter(attendance_date=target_date)
            record_map = {record.user_id: record for record in records}

            payload = []
            for student in students:
                record = record_map.get(student.id)
                allocation = RoomAllocation.objects.filter(student=student, end_date__isnull=True).select_related('room').first()
                room_number = allocation.room.room_number if allocation else None
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

        students = User.objects.filter(groups__name='Student')
        for student in students:
            Attendance.objects.update_or_create(
                user=student,
                attendance_date=attendance_date,
                defaults={'status': status_value}
            )

        return Response({'detail': 'Attendance marked for all students.'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Return attendance stats for a date."""
        date_param = request.query_params.get('date')
        target_date = date.today()
        if date_param:
            try:
                target_date = date.fromisoformat(date_param)
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        total_students = User.objects.filter(groups__name='Student').count()
        present_today = Attendance.objects.filter(attendance_date=target_date, status='present').count()
        absent_today = Attendance.objects.filter(attendance_date=target_date, status='absent').count()
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

        since = date.today() - timedelta(days=30)
        students = User.objects.filter(groups__name='Student')
        payload = []

        for student in students:
            absences = Attendance.objects.filter(
                user=student,
                attendance_date__gte=since,
                status='absent'
            )
            absent_days = absences.count()
            if absent_days < 3:
                continue

            last_present = Attendance.objects.filter(
                user=student,
                status='present'
            ).order_by('-attendance_date').first()

            allocation = RoomAllocation.objects.filter(student=student, end_date__isnull=True).select_related('room').first()
            room_number = allocation.room.room_number if allocation else None

            payload.append({
                'id': student.id,
                'name': student.get_full_name() or student.username,
                'hall_ticket': student.username,
                'room_number': room_number,
                'absent_days': absent_days,
                'last_present': last_present.attendance_date if last_present else None,
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
        user_id = request.query_params.get('user_id')
        month = request.query_params.get('month')  # YYYY-MM
        
        if not month or not user_id:
            return Response({'error': 'user_id and month parameters required'},
                            status=status.HTTP_400_BAD_REQUEST)
        
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
