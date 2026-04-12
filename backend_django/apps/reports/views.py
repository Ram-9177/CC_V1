"""Reports views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import (
    IsAdmin,
    CanViewReportsModule,
    CanManageReportsModule,
)
from django.db.models import Count, F, Q
from django.http import HttpResponse
from django.utils import timezone
from .models import Report
from .serializers import ReportSerializer
from apps.attendance.models import Attendance
from apps.rooms.models import RoomAllocation, Room
from apps.gate_passes.models import GatePass
from datetime import datetime, timedelta
from core.utils.cache import cache_dashboard_response
from core.college_mixin import CollegeScopeMixin
import csv


class ReportViewSet(CollegeScopeMixin, viewsets.ReadOnlyModelViewSet):
    """ViewSet for Report management."""
    
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """RBAC-first access for reports.

        - Read/report endpoints: requires reports:view capability.
        - Report generation endpoints: requires reports:manage capability.
        """
        if self.action in ['generate_attendance_report', 'generate_occupancy_report']:
            permission_classes = [
                IsAuthenticated,
                CanManageReportsModule | IsAdmin,
            ]
        else:
            permission_classes = [
                IsAuthenticated,
                CanViewReportsModule | IsAdmin,
            ]
        return [permission() for permission in permission_classes]
    
    @action(detail=False, methods=['post'])
    def generate_attendance_report(self, request):
        """Generate attendance report."""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        if not start_date or not end_date:
            return Response({'error': 'start_date and end_date required'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Aggregate attendance data
        attendance_qs = Attendance.objects.filter(attendance_date__range=[start_date, end_date])
        if getattr(request.user, 'college', None):
            attendance_qs = attendance_qs.filter(user__college=request.user.college)

        attendance_stats = attendance_qs.values('status').annotate(count=Count('id'))
        
        data = {stat['status']: stat['count'] for stat in attendance_stats}
        
        report = Report.objects.create(
            title=f'Attendance Report {start_date} to {end_date}',
            report_type='attendance',
            generated_by=request.user,
            start_date=start_date,
            end_date=end_date,
            data=data,
            summary=f'Total records: {sum(data.values())}',
            college=getattr(request.user, 'college', None)
        )
        
        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def generate_occupancy_report(self, request):
        """Generate room occupancy report."""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        # Aggregate occupancy data (filtered by college via mixin)
        occupancy_data = RoomAllocation.objects.filter(
            room__building__hostel__college=getattr(request.user, 'college', None),
            created_at__range=[start_date, end_date]
        ).values('room__floor').annotate(
            count=Count('id'),
            occupied=Count('id', filter=Q(end_date__isnull=True))
        )
        
        data = {
            f"Floor {item['room__floor']}": {
                'total': item['count'],
                'occupied': item['occupied']
            }
            for item in occupancy_data
        }
        
        report = Report.objects.create(
            title=f'Occupancy Report {start_date} to {end_date}',
            report_type='occupancy',
            generated_by=request.user,
            start_date=start_date,
            end_date=end_date,
            data=data,
            college=getattr(request.user, 'college', None)
        )
        
        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='attendance')
    @cache_dashboard_response(timeout=300, prefix='report_att')
    def attendance_report(self, request):
        """Return attendance trend data for charts."""
        period = request.query_params.get('period', 'week')
        today = timezone.now().date()

        from django.db.models.functions import TruncMonth

        if period == 'year':
            start_date = today.replace(month=1, day=1)
            trunc_func = TruncMonth('attendance_date')
            date_format = '%Y-%m'
        elif period == 'month':
            start_date = today.replace(day=1)
            trunc_func = F('attendance_date')
            date_format = '%Y-%m-%d'
        else:
            start_date = today - timedelta(days=6)
            trunc_func = F('attendance_date')
            date_format = '%Y-%m-%d'

        stats = Attendance.objects.filter(
            attendance_date__range=[start_date, today]
        ).filter(
            Q(user__college_id=request.user.college_id) if request.user.college_id else Q()
        ).annotate(
            period_date=trunc_func
        ).values('period_date').annotate(
            present=Count('id', filter=Q(status='present')),
            absent=Count('id', filter=Q(status='absent')),
            total=Count('id')
        ).order_by('period_date')

        payload = []
        for stat in stats:
            total = stat['total']
            percentage = (stat['present'] / total * 100) if total else 0
            payload.append({
                'date': stat['period_date'].strftime(date_format) if stat['period_date'] else '',
                'present': stat['present'],
                'absent': stat['absent'],
                'total': total,
                'percentage': round(percentage, 2),
            })
        
        return Response(payload)

    @action(detail=False, methods=['post'], url_path='attendance')
    def attendance_report_legacy_post(self, request):
        """Compatibility endpoint for legacy FE hooks expecting POST /reports/attendance/."""
        return self.export_report(request, report_type='attendance')

    @action(detail=False, methods=['get'], url_path='rooms')
    @cache_dashboard_response(timeout=300, prefix='report_room')
    def rooms_report(self, request):
        """Return room occupancy by floor."""
        stats = Room.objects.filter(
            building__hostel__college=getattr(request.user, 'college', None)
        ).values('floor').annotate(
            total_rooms=Count('id'),
            occupied=Count('id', filter=Q(current_occupancy__gt=0))
        ).order_by('floor')

        payload = []
        for stat in stats:
            total = stat['total_rooms']
            occupied = stat['occupied']
            available = total - occupied
            rate = (occupied / total * 100) if total else 0
            
            payload.append({
                'floor': stat['floor'],
                'total_rooms': total,
                'occupied': occupied,
                'available': available,
                'occupancy_rate': round(rate, 2),
            })

        return Response(payload)

    @action(detail=False, methods=['post'], url_path='occupancy')
    def occupancy_report_legacy_post(self, request):
        """Compatibility endpoint for legacy FE hooks expecting POST /reports/occupancy/."""
        return self.export_report(request, report_type='rooms')

    @action(detail=False, methods=['get'], url_path='gate-passes')
    @cache_dashboard_response(timeout=300, prefix='report_gp')
    def gate_passes_report(self, request):
        """Return gate pass stats grouped by month."""
        today = timezone.now().date()
        start_date = today.replace(day=1) - timedelta(days=180)
        from django.db.models.functions import TruncMonth

        user = self.request.user
        gp_cf = Q(college=user.college) if user.college else Q()
        
        stats = GatePass.objects.filter(
            gp_cf,
            exit_date__date__range=[start_date, today]
        ).annotate(
            period=TruncMonth('exit_date')
        ).values('period').annotate(
            total=Count('id'),
            approved=Count('id', filter=Q(status='approved')),
            pending=Count('id', filter=Q(status='pending')),
            rejected=Count('id', filter=Q(status='rejected')),
            used=Count('id', filter=Q(status='used')),
            expired=Count('id', filter=Q(status='expired'))
        ).order_by('period')

        payload = []
        for stat in stats:
            if not stat['period']: continue
            payload.append({
                'month': stat['period'].strftime('%Y-%m'),
                'total': stat['total'],
                'approved': stat['approved'] + stat['used'],
                'pending': stat['pending'],
                'rejected': stat['rejected'] + stat['expired'],
            })
        
        return Response(payload)

    @action(detail=False, methods=['post'], url_path='gate-passes')
    def gate_passes_report_legacy_post(self, request):
        """Compatibility endpoint for legacy FE hooks expecting POST /reports/gate-passes/."""
        return self.export_report(request, report_type='gate-passes')

    @action(detail=False, methods=['get'], url_path=r'(?P<report_type>[^/]+)/export')
    def export_report(self, request, report_type=None):
        """Export reports as CSV."""
        from django.http import StreamingHttpResponse
        
        report_type = (report_type or '').strip()

        class Echo:
            def write(self, value):
                return value

        def stream_csv(header, rows):
            writer = csv.writer(Echo())
            yield writer.writerow(header)
            for row in rows:
                yield writer.writerow(row)

        if report_type == 'attendance':
             header = ['date', 'present', 'absent', 'total', 'percentage']
             data = self.attendance_report(request).data
             rows = ([r['date'], r['present'], r['absent'], r['total'], r['percentage']] for r in data)
             
             response = StreamingHttpResponse(stream_csv(header, rows), content_type='text/csv')
             response['Content-Disposition'] = f'attachment; filename="attendance-report.csv"'
             return response

        if report_type == 'rooms':
             header = ['floor', 'total_rooms', 'occupied', 'available', 'occupancy_rate']
             data = self.rooms_report(request).data
             rows = ([r['floor'], r['total_rooms'], r['occupied'], r['available'], r['occupancy_rate']] for r in data)

             response = StreamingHttpResponse(stream_csv(header, rows), content_type='text/csv')
             response['Content-Disposition'] = f'attachment; filename="rooms-report.csv"'
             return response

        if report_type in ['gate-passes', 'gate_passes']:
             header = ['month', 'total', 'approved', 'pending', 'rejected']
             data = self.gate_passes_report(request).data
             rows = ([r['month'], r['total'], r['approved'], r['pending'], r['rejected']] for r in data)

             response = StreamingHttpResponse(stream_csv(header, rows), content_type='text/csv')
             response['Content-Disposition'] = f'attachment; filename="gate-passes-report.csv"'
             return response

        return Response({'detail': 'Unsupported report type'}, status=status.HTTP_400_BAD_REQUEST)
