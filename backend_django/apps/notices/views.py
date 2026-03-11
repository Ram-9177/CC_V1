"""Notices views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsChef, IsWarden, IsStudentHR, user_is_admin, user_is_staff, user_is_student
from core.role_scopes import user_is_top_level_management
from django.utils import timezone
from .models import Notice
from .serializers import NoticeSerializer
from apps.notifications.utils import notify_all_users, notify_role, notify_group
from apps.auth.models import User
from websockets.broadcast import broadcast_to_role


class NoticeViewSet(viewsets.ModelViewSet):
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
    
    def get_permissions(self):
        """Only admins can create/update notices."""
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            permission_classes = [IsAdmin | IsChef | IsWarden | IsStudentHR]
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
        """Filter by target audience and building."""
        user = self.request.user
        qs = super().get_queryset()

        if user_is_top_level_management(user):
            return qs

        from django.db.models import Q
        from apps.rooms.models import RoomAllocation

        # Base filter by role
        role_filter = Q(target_audience='all')
        
        if user.role == 'student':
            role_filter |= Q(target_audience='students')
            
            # Check for block-specific notices
            active_alloc = RoomAllocation.objects.filter(student=user, end_date__isnull=True).select_related('room__building').first()
            if active_alloc:
                role_filter |= Q(target_audience='block', target_building=active_alloc.room.building)
                
        elif user.role == 'warden':
            role_filter |= Q(target_audience='wardens')
            role_filter |= Q(target_audience='staff')
        elif user.role in ['chef', 'head_chef']:
            role_filter |= Q(target_audience='chefs')
            role_filter |= Q(target_audience='staff')
        elif user.role == 'staff':
            role_filter |= Q(target_audience='staff')
            
        return qs.filter(role_filter).distinct()
    
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

        notice = serializer.save(
            author=user,
            target_audience=target or 'all',
            target_building_id=building_id
        )

        # Trigger Notifications
        notif_title = f"{'🚨 ' if notice.priority == 'urgent' else '📌 '}{notice.title}"
        if category == 'event':
            notif_title = f"🗓️ New Event: {notice.title}"
        
        notif_message = notice.content[:150] + ('...' if len(notice.content) > 150 else '')
        notif_type = 'alert' if notice.priority in ['urgent', 'high'] else 'info'
        
        # 1. IDENTIFY RECIPIENTS BY ROLE
        # Convert target_audience string to a list of role strings from database
        role_map = {
            'students': STUDENT_ROLES,
            'wardens': WARDEN_ROLES,
            'chefs': CHEF_ROLES,
            'staff': STAFF_ROLES,
            'admins': ADMIN_ROLES,
        }

        # Determine final queryset for notifs and logging count
        recipients_qs = User.objects.filter(is_active=True)
        
        if target == 'all':
            pass # Use base queryset of all active users
        elif target == 'block' and building_id:
            recipients_qs = recipients_qs.filter(
                room_allocations__room__building_id=building_id,
                room_allocations__end_date__isnull=True
            ).distinct()
        elif target in role_map:
            roles = role_map[target]
            recipients_qs = recipients_qs.filter(role__in=roles)
        else:
            # Fallback for manual string matching just in case
            singular_target = target.rstrip('s') if target.endswith('s') else target
            recipients_qs = recipients_qs.filter(role=singular_target)

        # 2. TRIGGER NOTIFICATIONS (In-App and Web Push)
        # Using a list to ensure we don't hit the DB in the loop for large counts
        recipient_ids = list(recipients_qs.values_list('id', flat=True))
        
        # Performance optimization: For 'all', use notify_all_users
        if target == 'all':
             notify_all_users(notif_title, notif_message, notif_type, action_url='/notices')
        else:
             notify_group(recipients_qs, notif_title, notif_message, notif_type, action_url='/notices')

        # 3. RECORD NOTICE LOG
        NoticeLog.objects.create(
            notice=notice,
            sender=user,
            target_role=target or 'all',
            users_notified_count=len(recipient_ids)
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
        cache.delete_pattern("notices:list:*")

    def perform_update(self, serializer):
        notice = serializer.save()
        from django.core.cache import cache
        cache.delete_pattern("notices:list:*")
        
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
        cache.delete_pattern("notices:list:*")
        
        for role in ['student', 'staff', 'warden', 'chef']:
            broadcast_to_role(role, 'notice_deleted', {'id': notice_id, 'resource': 'notice'})

