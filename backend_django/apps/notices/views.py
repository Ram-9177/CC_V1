"""Notices views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsChef, IsWarden, IsStudentHR, IsManagement, user_is_admin, user_is_staff, user_is_student
from core.role_scopes import user_is_top_level_management
from core.college_mixin import CollegeScopeMixin
from django.utils import timezone
from .models import Notice
from .serializers import NoticeSerializer
from apps.notifications.service import NotificationService
from apps.auth.models import User
from websockets.broadcast import broadcast_to_role
from core.filters import AudienceFilterMixin


class NoticeViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for Notice management."""
    
    # select_related fixes N+1: NoticeSerializer.author_details and
    # target_building_details both access FK relations. Without this every
    # row in the list emits an extra SELECT. Cost: 0 extra queries (JOIN).
    queryset = Notice.objects.select_related('author', 'target_building').filter(
        is_published=True
    ).exclude(
        expires_at__isnull=False, expires_at__lt=timezone.now()
    ).order_by('-published_date')
    serializer_class = NoticeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [] # We'll use get_queryset for custom logic
    
    def get_permissions(self):
        """Only admins can create/update notices."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            from core.permissions import IsSportsAuthority
            permission_classes = [IsAdmin | IsChef | IsWarden | IsStudentHR | IsSportsAuthority | IsManagement]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def list(self, request, *args, **kwargs):
        from django.core.cache import cache
        user = request.user
        query_params = request.query_params.urlencode()
        # Scope by building/role since get_queryset filters based on them
        cache_key = f"notices:list:{user.role}:{user.id}:{query_params}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        
        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 30) # 30s cache
        return response

    
    def get_queryset(self):
        """Filter by target audience and building, with college scoping."""
        qs = super().get_queryset()
        return AudienceFilterMixin().filter_audience(self.request, qs)
    
    @action(detail=False, methods=['get'])
    def urgent(self, request):
        """Get urgent notices."""
        notices = self.get_queryset().filter(priority='urgent')
        serializer = self.get_serializer(notices, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        from apps.rooms.models import RoomAllocation
        from rest_framework.exceptions import PermissionDenied
        from .models import NoticeLog
        from core.permissions import STUDENT_ROLES, STAFF_ROLES, WARDEN_ROLES, CHEF_ROLES, ADMIN_ROLES
        from django.db.models import Q

        user = self.request.user
        target = self.request.data.get('target_audience')
        building_id = self.request.data.get('target_building')
        category = self.request.data.get('category', 'general')

        # Regular students CANNOT create notices at all
        if user.role == 'student' and not getattr(user, 'is_student_hr', False) and not user.groups.filter(name='Student_HR').exists():
            raise PermissionDenied("Only authorized staff or HR can create notices.")

        # Student HR: Scope notices to their own assigned block only
        is_student_hr = getattr(user, 'is_student_hr', False) or user.groups.filter(name='Student_HR').exists()
        if is_student_hr and not user_is_top_level_management(user):
            # Force target to 'block' scoped to their building
            hr_alloc = RoomAllocation.objects.filter(
                student=user, end_date__isnull=True
            ).select_related('room__building').first()

            if hr_alloc:
                target = 'block'
                building_id = hr_alloc.room.building_id
            else:
                target = 'students'
                building_id = None

        # Role-Based Audience Enforcement
        if user.role == 'warden' and target != 'hostellers':
             target = 'hostellers'
        elif user.role in ['pd', 'pt']:
             target = 'all_students'
             category = 'sports' # Auto-categorize sports notices

        notice = serializer.save(
            author=user,
            target_audience=target or 'all',
            target_building_id=building_id,
            college=getattr(user, 'college', None),
        )

        # Trigger Notifications
        notif_title = f"{'🚨 ' if notice.priority == 'urgent' else '📌 '}{notice.title}"
        if category == 'event':
            notif_title = f"🗓️ New Event: {notice.title}"
        
        notif_message = notice.content[:150] + ('...' if len(notice.content) > 150 else '')
        notif_type = 'alert' if notice.priority in ['urgent', 'high'] else 'info'

        role_map = {
            'students': ['student'],
            'wardens': ['warden', 'head_warden'],
            'chefs': ['chef', 'head_chef'],
            'staff': [
                'staff', 'warden', 'head_warden', 'incharge', 'hr',
                'pd', 'pt', 'gate_security', 'security_head',
                'chef', 'head_chef', 'principal', 'director', 'hod',
            ],
            'admins': ['admin', 'super_admin'],
        }
        
        # 1. TRIGGER TARGETED NOTIFICATIONS
        if target in ['all', 'all_students', 'hostellers', 'day_scholars']:
            NotificationService.send_to_audience(target, notif_title, notif_message, notif_type, action_url='/notices')
        elif target == 'block' and building_id:
            # Handle block-specific notifications manually for now
            recipients_qs = User.objects.filter(
                is_active=True,
                room_allocations__room__building_id=building_id,
                room_allocations__end_date__isnull=True
            ).distinct()
            NotificationService.send_to_group(recipients_qs, notif_title, notif_message, notif_type, action_url='/notices')
        elif target in role_map:
            roles = role_map[target]
            recipients_qs = User.objects.filter(is_active=True, role__in=roles)
            NotificationService.send_to_group(recipients_qs, notif_title, notif_message, notif_type, action_url='/notices')
            
        # 2. RECORD NOTICE LOG
        NoticeLog.objects.create(
            notice=notice,
            sender=user,
            target_role=target or 'all',
            # Count will be approximate if using notify_targeted_students without manual count
            users_notified_count=0 
        )

        # 4. WEBSOCKET BROADCAST TO ROLES
        payload = {
            'id': notice.id,
            'title': notice.title,
            'priority': notice.priority,
            'resource': 'notice',
        }
        for role in ['student', 'staff', 'warden', 'chef', 'admin', 'super_admin']:
            broadcast_to_role(role, 'notice_created', payload)
        
        # Invalidate caches
        from django.core.cache import cache
        try:
            if hasattr(cache, 'delete_pattern'):
                cache.delete_pattern("notices:list:*")
        except Exception:
            pass

    def perform_update(self, serializer):
        notice = serializer.save()
        from django.core.cache import cache
        try:
            if hasattr(cache, 'delete_pattern'):
                cache.delete_pattern("notices:list:*")
        except Exception:
            pass
        
        payload = {
            'id': notice.id,
            'title': notice.title,
            'priority': notice.priority,
            'status': 'updated',
            'resource': 'notice',
        }
        for role in ['student', 'staff', 'warden', 'chef']:
            broadcast_to_role(role, 'notice_updated', payload)

    def perform_destroy(self, instance):
        notice_id = instance.id
        instance.delete()
        from django.core.cache import cache
        try:
            if hasattr(cache, 'delete_pattern'):
                cache.delete_pattern("notices:list:*")
        except Exception:
            pass
        
        for role in ['student', 'staff', 'warden', 'chef']:
            broadcast_to_role(role, 'notice_deleted', {'id': notice_id, 'resource': 'notice'})

