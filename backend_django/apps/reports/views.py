"""Reports views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsWarden, IsSecurityHead
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from .models import Report
from .serializers import ReportSerializer
from apps.attendance.models import Attendance
from apps.rooms.models import RoomAllocation, Room
from apps.gate_passes.models import GatePass
from datetime import datetime, timedelta
import csv


class ReportViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for Report management."""
    
    queryset = Report.objects.all()
    serializer_class = ReportSerializer
    permission_classes = [IsAuthenticated, IsAdmin | IsWarden | IsSecurityHead]
    
    @action(detail=False, methods=['post'])
    def generate_attendance_report(self, request):
        """Generate attendance report."""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        if not start_date or not end_date:
            return Response({'error': 'start_date and end_date required'},
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Aggregate attendance data
        attendance_stats = Attendance.objects.filter(
            attendance_date__range=[start_date, end_date]
        ).values('status').annotate(count=Count('id'))
        
        data = {stat['status']: stat['count'] for stat in attendance_stats}
        
        report = Report.objects.create(
            title=f'Attendance Report {start_date} to {end_date}',
            report_type='attendance',
            generated_by=request.user,
            start_date=start_date,
            end_date=end_date,
            data=data,
            summary=f'Total records: {sum(data.values())}'
        )
        
        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['post'])
    def generate_occupancy_report(self, request):
        """Generate room occupancy report."""
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        # Aggregate occupancy data
        occupancy_data = RoomAllocation.objects.filter(
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
            data=data
        )
        
        serializer = self.get_serializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='attendance')
    def attendance_report(self, request):
        """Return attendance trend data for charts."""
        period = request.query_params.get('period', 'week')
        today = timezone.now().date()

        if period == 'year':
            start_date = today.replace(month=1, day=1)
            # Group by month for yearly stats
            trunc_func = TruncMonth('attendance_date')
            date_format = '%Y-%m'
        elif period == 'month':
            start_date = today.replace(day=1)
            trunc_func = TruncDate('attendance_date')
            date_format = '%Y-%m-%d'
        else:
            start_date = today - timedelta(days=6)
            trunc_func = TruncDate('attendance_date')
            date_format = '%Y-%m-%d'

        from django.db.models.functions import TruncDate, TruncMonth
        from django.db.models import Sum, Case, When, IntegerField

        stats = Attendance.objects.filter(
            attendance_date__range=[start_date, today]
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

    @action(detail=False, methods=['get'], url_path='rooms')
    def rooms_report(self, request):
        """Return room occupancy by floor."""
        stats = Room.objects.values('floor').annotate(
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

    @action(detail=False, methods=['get'], url_path='gate-passes')
    def gate_passes_report(self, request):
        """Return gate pass stats grouped by month."""
        today = timezone.now().date()
        start_date = today.replace(day=1) - timedelta(days=180)
        from django.db.models.functions import TruncMonth

        # Aggregate strictly by month
        stats = GatePass.objects.filter(
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
                'approved': stat['approved'] + stat['used'], # Combine approved/used
                'pending': stat['pending'],
                'rejected': stat['rejected'] + stat['expired'],
            })
        
        return Response(payload)

    @action(detail=False, methods=['get'], url_path=r'(?P<report_type>[^/]+)/export')
    def export_report(self, request, report_type=None):
        """Export reports as CSV."""
        report_type = (report_type or '').strip()

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="{report_type}-report.csv"'
        writer = csv.writer(response)

        if report_type == 'attendance':
            writer.writerow(['date', 'present', 'absent', 'total', 'percentage'])
            data = self.attendance_report(request).data
            for row in data:
                writer.writerow([row['date'], row['present'], row['absent'], row['total'], row['percentage']])
            return response

        if report_type == 'rooms':
            writer.writerow(['floor', 'total_rooms', 'occupied', 'available', 'occupancy_rate'])
            data = self.rooms_report(request).data
            for row in data:
                writer.writerow([row['floor'], row['total_rooms'], row['occupied'], row['available'], row['occupancy_rate']])
            return response

        if report_type in ['gate-passes', 'gate_passes']:
            writer.writerow(['month', 'total', 'approved', 'pending', 'rejected'])
            data = self.gate_passes_report(request).data
            for row in data:
                writer.writerow([row['month'], row['total'], row['approved'], row['pending'], row['rejected']])
            return response

        response.status_code = status.HTTP_400_BAD_REQUEST
        response.write('Unsupported report type')
        return response
