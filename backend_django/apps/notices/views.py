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
        elif user.role == 'chef':
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
        # Restriction: Student HR can only target 'students' or 'all'
        target = self.request.data.get('target_audience')
        building_id = self.request.data.get('target_building')
        category = self.request.data.get('category', 'general')
        
        if self.request.user.groups.filter(name='Student_HR').exists():
            if target not in ['students', 'all']:
                target = 'students'
        
        notice = serializer.save(
            author=self.request.user, 
            target_audience=target or 'all',
            target_building_id=building_id
        )

        # Trigger Notifications
        notif_title = f"{'🚨 ' if notice.priority == 'urgent' else '📌 '}{notice.title}"
        if category == 'event':
            notif_title = f"🗓️ New Event: {notice.title}"
        
        notif_message = notice.content[:150] + ('...' if len(notice.content) > 150 else '')
        notif_type = 'alert' if notice.priority in ['urgent', 'high'] else 'info'
        
        # Determine recipients
        if target == 'all':
            notify_all_users(notif_title, notif_message, notif_type, action_url='/notices')
        elif target == 'block' and building_id:
            from apps.rooms.models import RoomAllocation
            students_in_block = User.objects.filter(
                room_allocations__room__building_id=building_id,
                room_allocations__end_date__isnull=True
            ).distinct()
            notify_group(students_in_block, notif_title, notif_message, notif_type, action_url='/notices')
        elif target in ['students', 'staff', 'wardens', 'chefs']:
            # Handle specific roles (staff is a meta-role in some contexts, but here it's literally target='staff')
            notify_role(target, notif_title, notif_message, notif_type, action_url='/notices')

        payload = {
            'id': notice.id,
            'title': notice.title,
            'priority': notice.priority,
            'resource': 'notice',
        }
        for role in [
            'student',
            'staff',
            'admin',
            'super_admin',
            'warden',
            'head_warden',
            'chef',
            'gate_security',
            'security_head',
        ]:
            broadcast_to_role(role, 'notice_created', payload)

    def perform_update(self, serializer):
        notice = serializer.save()

        payload = {
            'id': notice.id,
            'title': notice.title,
            'priority': notice.priority,
            'resource': 'notice',
        }
        for role in [
            'student',
            'staff',
            'admin',
            'super_admin',
            'warden',
            'head_warden',
            'chef',
            'gate_security',
            'security_head',
        ]:
            broadcast_to_role(role, 'notice_updated', payload)

    def perform_destroy(self, instance):
        notice_id = instance.id
        super().perform_destroy(instance)

        payload = {'id': notice_id, 'resource': 'notice'}
        for role in [
            'student',
            'staff',
            'admin',
            'super_admin',
            'warden',
            'head_warden',
            'chef',
            'gate_security',
            'security_head',
        ]:
            broadcast_to_role(role, 'notice_deleted', payload)
