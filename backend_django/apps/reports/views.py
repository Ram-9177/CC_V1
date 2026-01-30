"""Reports views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsWarden
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
    permission_classes = [IsAuthenticated, IsAdmin | IsWarden]
    
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
        elif period == 'month':
            start_date = today.replace(day=1)
        else:
            start_date = today - timedelta(days=6)

        records = Attendance.objects.filter(attendance_date__range=[start_date, today])

        stats_by_date = {}
        for record in records:
            key = record.attendance_date.isoformat()
            if key not in stats_by_date:
                stats_by_date[key] = {'present': 0, 'absent': 0, 'total': 0}
            stats_by_date[key]['total'] += 1
            if record.status == 'present':
                stats_by_date[key]['present'] += 1
            elif record.status == 'absent':
                stats_by_date[key]['absent'] += 1

        payload = []
        current_date = start_date
        while current_date <= today:
            key = current_date.isoformat()
            stats = stats_by_date.get(key, {'present': 0, 'absent': 0, 'total': 0})
            total = stats['total']
            percentage = (stats['present'] / total * 100) if total else 0
            payload.append({
                'date': key,
                'present': stats['present'],
                'absent': stats['absent'],
                'total': total,
                'percentage': round(percentage, 2),
            })
            current_date += timedelta(days=1)

        return Response(payload)

    @action(detail=False, methods=['get'], url_path='rooms')
    def rooms_report(self, request):
        """Return room occupancy by floor."""
        floors = Room.objects.values_list('floor', flat=True).distinct().order_by('floor')
        payload = []
        for floor in floors:
            total_rooms = Room.objects.filter(floor=floor).count()
            occupied = Room.objects.filter(floor=floor, current_occupancy__gt=0).count()
            available = total_rooms - occupied
            occupancy_rate = (occupied / total_rooms * 100) if total_rooms else 0
            payload.append({
                'floor': floor,
                'total_rooms': total_rooms,
                'occupied': occupied,
                'available': available,
                'occupancy_rate': round(occupancy_rate, 2),
            })

        return Response(payload)

    @action(detail=False, methods=['get'], url_path='gate-passes')
    def gate_passes_report(self, request):
        """Return gate pass stats grouped by month."""
        today = timezone.now().date()
        start_date = today.replace(day=1) - timedelta(days=180)
        gate_passes = GatePass.objects.filter(exit_date__date__range=[start_date, today])

        data = {}
        for gate_pass in gate_passes:
            month_key = gate_pass.exit_date.strftime('%Y-%m')
            if month_key not in data:
                data[month_key] = {'total': 0, 'approved': 0, 'pending': 0, 'rejected': 0}
            data[month_key]['total'] += 1
            if gate_pass.status in data[month_key]:
                data[month_key][gate_pass.status] += 1

        payload = [
            {
                'month': key,
                'total': stats['total'],
                'approved': stats['approved'],
                'pending': stats['pending'],
                'rejected': stats['rejected'],
            }
            for key, stats in sorted(data.items())
        ]

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
