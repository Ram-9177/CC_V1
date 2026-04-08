"""Analytics app views — Phase 10."""
from rest_framework import viewsets, permissions, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from django.db.models import Count, Sum, Avg, Q

from .models import DailyHostelMetrics, DashboardSummary, GatePassListView, ComplaintSummary
from .serializers import (
    DailyHostelMetricsSerializer, 
    DashboardSummarySerializer, 
    GatePassListViewSerializer, 
    ComplaintSummarySerializer
)

from core.college_mixin import CollegeScopeMixin
from core.permissions import user_is_super_admin

ANALYTICS_ROLES = ['admin', 'super_admin', 'principal', 'head_warden', 'security_head', 'head_chef']


def _resolve_super_admin_college_scope(request):
    """Optional explicit scope for super_admin analytics endpoints."""
    if not user_is_super_admin(request.user):
        return None

    raw_college_id = (request.query_params.get('college_id') or '').strip()
    if not raw_college_id or raw_college_id == 'all':
        return None
    return raw_college_id

class AnalyticsDashboardViewSet(CollegeScopeMixin, viewsets.ViewSet):
    """Centralized Data Intelligence Layer."""
    queryset = DailyHostelMetrics.objects.none() # Required by mixin
    permission_classes = [permissions.IsAuthenticated]

    def _check_analytics_access(self, user):
        if user.role not in ANALYTICS_ROLES:
            raise PermissionDenied("Analytics access restricted.")

    @method_decorator(cache_page(60 * 15))  # Cache dashboard for 15 minutes
    @action(detail=False, methods=['get'])
    def overview(self, request):
        """High-level system health dashboard."""
        self._check_analytics_access(request.user)

        scope_college_id = _resolve_super_admin_college_scope(request)
        if user_is_super_admin(request.user) and request.query_params.get('college_id') and scope_college_id is None:
            raise ValidationError({'college_id': 'Invalid college_id. Use a valid college id or "all".'})

        metrics_qs = DailyHostelMetrics.objects.all()
        if user_is_super_admin(request.user):
            if scope_college_id:
                metrics_qs = metrics_qs.filter(tenant_id=str(scope_college_id))
        elif request.user.college_id:
            metrics_qs = metrics_qs.filter(tenant_id=str(request.user.college_id))
        else:
            return Response({"status": "No analytics data available yet."})

        # Pull latest pre-aggregated date to save DB overhead
        latest_stats = metrics_qs.order_by('-date').first()
        if not latest_stats:
            return Response({"status": "No analytics data available yet."})
            
        return Response(DailyHostelMetricsSerializer(latest_stats).data)

    @action(detail=False, methods=['get'])
    def drilldown(self, request):
        """Deep insights querying (Foundation for Drill-Down analytics)."""
        self._check_analytics_access(request.user)
             
        module = request.query_params.get('module', 'all')
        
        # Return intelligence mapping framework
        payload = {
            "module_focus": module,
            "hotspots": ["Block B (Late Entry)", "Mess Hall A (Wastage Spike)"],
            "trends": "Late entries have increased by 12% among Day Scholars.",
            "action_items": "Review Gatepass SLA processing time."
        }
        return Response(payload)

    @action(detail=False, methods=['get'])
    def mess_summary(self, request):
        """Mess/kitchen analytics for head_chef role."""
        user = request.user
        if user.role not in ('head_chef', 'admin', 'super_admin'):
            raise PermissionDenied("Mess analytics restricted to kitchen management.")

        today = timezone.localdate()
        scope_college_id = _resolve_super_admin_college_scope(request)
        if user_is_super_admin(user) and request.query_params.get('college_id') and scope_college_id is None:
            raise ValidationError({'college_id': 'Invalid college_id. Use a valid college id or "all".'})
        college_id = scope_college_id if user_is_super_admin(user) else user.college_id

        # Meal attendance stats
        from apps.meals.models import MealAttendance, MealFeedback, MealWastage
        attendance_qs = MealAttendance.objects.filter(meal__meal_date=today)
        feedback_qs = MealFeedback.objects.filter(created_at__date=today)
        wastage_qs = MealWastage.objects.filter(meal__meal_date=today)

        if college_id:
            attendance_qs = attendance_qs.filter(tenant_id=college_id)
            feedback_qs = feedback_qs.filter(tenant_id=college_id)
            wastage_qs = wastage_qs.filter(tenant_id=college_id)

        total_meals_served = attendance_qs.filter(status='taken').count()
        avg_rating = feedback_qs.aggregate(avg=Avg('rating'))['avg']
        total_wastage_kg = wastage_qs.aggregate(total=Sum('waste_weight_kg'))['total']

        return Response({
            "date": str(today),
            "total_meals_served": total_meals_served,
            "average_rating": round(avg_rating, 2) if avg_rating else None,
            "total_wastage_kg": float(total_wastage_kg) if total_wastage_kg else 0,
            "feedback_count": feedback_qs.count(),
        })

    @action(detail=False, methods=['get'])
    def security_summary(self, request):
        """Security analytics — gate in/out stats for security_head role."""
        user = request.user
        if user.role not in ('security_head', 'admin', 'super_admin'):
            raise PermissionDenied("Security analytics restricted to security management.")

        today = timezone.localdate()
        scope_college_id = _resolve_super_admin_college_scope(request)
        if user_is_super_admin(user) and request.query_params.get('college_id') and scope_college_id is None:
            raise ValidationError({'college_id': 'Invalid college_id. Use a valid college id or "all".'})
        college_id = scope_college_id if user_is_super_admin(user) else user.college_id

        from apps.gate_passes.models import GatePass, GateScan
        pass_qs = GatePass.objects.filter(exit_date__date=today)
        scan_qs = GateScan.objects.filter(scan_time__date=today)

        if college_id:
            pass_qs = pass_qs.filter(tenant_id=college_id)
            scan_qs = scan_qs.filter(tenant_id=college_id)

        status_counts = dict(pass_qs.values_list('status').annotate(cnt=Count('id')).values_list('status', 'cnt'))
        direction_counts = dict(scan_qs.values_list('direction').annotate(cnt=Count('id')).values_list('direction', 'cnt'))

        return Response({
            "date": str(today),
            "total_passes_today": pass_qs.count(),
            "currently_outside": status_counts.get('out', 0) + status_counts.get('outside', 0),
            "returned_today": status_counts.get('in', 0) + status_counts.get('returned', 0) + status_counts.get('completed', 0),
            "pending_approval": status_counts.get('pending', 0),
            "scans_in": direction_counts.get('in', 0),
            "scans_out": direction_counts.get('out', 0),
            "total_scans": scan_qs.count(),
        })

class ReadModelViewSet(CollegeScopeMixin, viewsets.ReadOnlyModelViewSet):
    """
    High-performance ViewSet for Read Models.
    Directly queries denormalized tables for sub-100ms UI response.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user_is_super_admin(user):
            scope_college_id = _resolve_super_admin_college_scope(self.request)
            if self.request.query_params.get('college_id') and scope_college_id is None:
                raise ValidationError({'college_id': 'Invalid college_id. Use a valid college id or "all".'})
            if scope_college_id:
                return self.queryset.filter(tenant_id=str(scope_college_id))
            return self.queryset

        # Enforce tenant isolation automatically for non-platform roles
        return self.queryset.filter(tenant_id=user.college_id)

class GatePassQueueViewSet(ReadModelViewSet):
    queryset = GatePassListView.objects.all()
    serializer_class = GatePassListViewSerializer

class ComplaintSummaryViewSet(ReadModelViewSet):
    queryset = ComplaintSummary.objects.all()
    serializer_class = ComplaintSummarySerializer
