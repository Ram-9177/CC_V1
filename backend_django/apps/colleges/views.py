"""Colleges views — SaaS control plane."""

import logging

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.permissions import IsAdmin, IsTopLevel
from .models import College, CollegeModuleConfig
from .serializers import CollegeSerializer, CollegePublicSerializer, CollegeModuleConfigSerializer

logger = logging.getLogger(__name__)


def _is_super_admin(user) -> bool:
    return getattr(user, 'is_superuser', False) or getattr(user, 'role', '') == 'super_admin'


def _is_college_admin(user) -> bool:
    return getattr(user, 'role', '') in ('admin', 'super_admin') or getattr(user, 'is_superuser', False)


class CollegeViewSet(viewsets.ModelViewSet):
    """ViewSet for College management.

    Permissions
    -----------
    - list / retrieve : any authenticated user (public fields only for non-admins)
    - create / update / destroy / toggle_active : super_admin / top-level only
    - module_config : super_admin or college admin (scoped to own college)
    - usage_stats    : super_admin or college admin (scoped to own college)
    """

    queryset = College.objects.prefetch_related('module_configs').all()
    serializer_class = CollegeSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        write_actions = ['create', 'update', 'partial_update', 'destroy', 'toggle_active']
        if self.action in write_actions:
            return [IsTopLevel()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        # Non-admins get the minimal public view
        user = getattr(self.request, 'user', None)
        if user and _is_college_admin(user):
            return CollegeSerializer
        return CollegePublicSerializer

    def get_queryset(self):
        qs = College.objects.prefetch_related('module_configs').all()
        user = self.request.user
        # College admins (non-super) only see their own college
        if not _is_super_admin(user) and _is_college_admin(user):
            if user.college_id:
                return qs.filter(pk=user.college_id)
        return qs

    # ── Toggle active ─────────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Enable / disable a college. Super Admin only."""
        college = self.get_object()

        if not _is_super_admin(request.user):
            return Response(
                {'detail': 'Only Super Admins can enable/disable colleges.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        old_status = college.is_active
        college.is_active = not college.is_active
        college.disabled_reason = (
            request.data.get('reason', '') if not college.is_active else ''
        )
        college.save(update_fields=['is_active', 'disabled_reason', 'updated_at'])

        status_text = 'enabled' if college.is_active else 'disabled'
        user_count = college.users.filter(is_active=True).count()

        try:
            from core.audit import log_action
            log_action(request.user, 'UPDATE', college, changes={
                'is_active': [old_status, college.is_active],
                'action': f'college_{status_text}',
                'affected_users': user_count,
                'reason': college.disabled_reason,
            }, request=request)
        except Exception:
            pass

        return Response({
            'detail': f'College "{college.name}" has been {status_text}. {user_count} active users affected.',
            'is_active': college.is_active,
            'affected_users': user_count,
        })

    # ── Module config ─────────────────────────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='modules')
    def module_config(self, request, pk=None):
        """GET: list module configs. POST: enable/disable a module.

        Body for POST: { "module_name": "sports", "is_enabled": false }
        """
        college = self.get_object()

        # Scope check: college admin can only manage their own college
        if not _is_super_admin(request.user):
            if not _is_college_admin(request.user):
                return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
            if request.user.college_id != college.pk:
                return Response({'detail': 'You can only manage your own college modules.'}, status=status.HTTP_403_FORBIDDEN)

        if request.method == 'GET':
            configs = college.module_configs.all()
            return Response(CollegeModuleConfigSerializer(configs, many=True).data)

        # POST — upsert
        module_name = request.data.get('module_name', '').strip()
        is_enabled = request.data.get('is_enabled', True)

        if not module_name:
            return Response({'detail': 'module_name is required.'}, status=status.HTTP_400_BAD_REQUEST)

        cfg, created = CollegeModuleConfig.objects.update_or_create(
            college=college,
            module_name=module_name,
            defaults={'is_enabled': bool(is_enabled)},
        )

        # Invalidate RBAC cache for all users of this college when a module changes
        try:
            from core.rbac import clear_user_permission_cache
            for uid in college.users.values_list('id', flat=True):
                clear_user_permission_cache(uid)
        except Exception:
            pass

        action_word = 'created' if created else 'updated'
        logger.info(
            "CollegeModuleConfig %s: college=%s module=%s enabled=%s by user=%s",
            action_word, college.code, module_name, is_enabled, request.user.id,
        )

        return Response(CollegeModuleConfigSerializer(cfg).data, status=status.HTTP_200_OK)

    # ── Usage stats ───────────────────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='usage')
    def usage_stats(self, request, pk=None):
        """Per-college usage stats. Accessible by super_admin or own college admin."""
        college = self.get_object()

        if not _is_super_admin(request.user):
            if not _is_college_admin(request.user):
                return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
            if request.user.college_id != college.pk:
                return Response({'detail': 'Access restricted to your own college.'}, status=status.HTTP_403_FORBIDDEN)

        from apps.auth.models import User as AuthUser
        from apps.gate_passes.models import GatePass
        from apps.complaints.models import Complaint

        user_counts = (
            AuthUser.objects
            .filter(college=college)
            .values('role')
            .annotate(count=Count('id'))
        )
        role_map = {r['role']: r['count'] for r in user_counts}
        total_users = sum(role_map.values())

        gp_pending = GatePass.objects.filter(college=college, status='pending').count()
        gp_outside = GatePass.objects.filter(college=college, movement_status='outside').count()
        complaints_open = Complaint.objects.filter(college=college, status__in=['open', 'in_progress']).count()

        return Response({
            'college': college.code,
            'subscription_status': college.subscription_status,
            'max_users': college.max_users,
            'total_users': total_users,
            'at_limit': college.is_at_user_limit(),
            'users_by_role': role_map,
            'gate_passes': {'pending': gp_pending, 'outside': gp_outside},
            'complaints_open': complaints_open,
            'modules': CollegeModuleConfigSerializer(college.module_configs.all(), many=True).data,
            'generated_at': timezone.now().isoformat(),
        })

    # ── Subscription update ───────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='subscription')
    def update_subscription(self, request, pk=None):
        """Update subscription tier and user limit. Super Admin only."""
        if not _is_super_admin(request.user):
            return Response({'detail': 'Super Admin only.'}, status=status.HTTP_403_FORBIDDEN)

        college = self.get_object()
        new_status = request.data.get('subscription_status')
        max_users = request.data.get('max_users')

        update_fields = ['updated_at']
        if new_status and new_status in dict(College.SUBSCRIPTION_CHOICES):
            college.subscription_status = new_status
            update_fields.append('subscription_status')
        if max_users is not None:
            college.max_users = int(max_users)
            update_fields.append('max_users')

        college.save(update_fields=update_fields)

        return Response({
            'detail': 'Subscription updated.',
            'subscription_status': college.subscription_status,
            'max_users': college.max_users,
        })


# ── Platform-wide super admin analytics ──────────────────────────────────────

class SuperAdminAnalyticsView(APIView):
    """Platform-level analytics for super_admin.

    GET /api/colleges/platform-analytics/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _is_super_admin(request.user):
            return Response({'detail': 'Super Admin only.'}, status=status.HTTP_403_FORBIDDEN)

        from django.core.cache import cache
        cache_key = 'saas:platform_analytics:v1'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        from apps.auth.models import User as AuthUser
        from apps.gate_passes.models import GatePass

        total_colleges = College.objects.count()
        active_colleges = College.objects.filter(is_active=True).count()

        college_stats = (
            College.objects
            .annotate(
                total_users=Count('users', distinct=True),
                active_users=Count('users', filter=Q(users__is_active=True), distinct=True),
            )
            .values('id', 'name', 'code', 'subscription_status', 'is_active', 'total_users', 'active_users')
            .order_by('name')
        )

        total_users = AuthUser.objects.count()
        active_users = AuthUser.objects.filter(is_active=True).count()
        students = AuthUser.objects.filter(role='student').count()
        staff = AuthUser.objects.exclude(role='student').count()

        passes_today = GatePass.objects.filter(
            created_at__date=timezone.localdate()
        ).count()

        by_plan = (
            College.objects
            .values('subscription_status')
            .annotate(count=Count('id'))
        )

        data = {
            'platform': {
                'total_colleges': total_colleges,
                'active_colleges': active_colleges,
                'inactive_colleges': total_colleges - active_colleges,
                'total_users': total_users,
                'active_users': active_users,
                'students': students,
                'staff': staff,
                'gate_passes_today': passes_today,
            },
            'by_plan': {row['subscription_status']: row['count'] for row in by_plan},
            'colleges': list(college_stats),
            'generated_at': timezone.now().isoformat(),
        }

        cache.set(cache_key, data, 120)  # 2-minute cache
        return Response(data)
