"""Notices views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsChef, IsWarden, IsStudentHR, user_is_admin, user_is_staff, user_is_student
from django.utils import timezone
from .models import Notice
from .serializers import NoticeSerializer
from websockets.broadcast import broadcast_to_role


class NoticeViewSet(viewsets.ModelViewSet):
    """ViewSet for Notice management."""
    
    queryset = Notice.objects.filter(is_published=True).exclude(
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
        """Filter by target audience."""
        user = self.request.user
        qs = super().get_queryset()

        if user_is_admin(user):
            return qs
        if user_is_student(user):
            return qs.filter(target_audience__in=['all', 'students'])
        if user_is_staff(user) or user.role == 'chef':
            return qs.filter(target_audience__in=['all', 'wardens', 'chefs', 'staff'])
        
        return qs
    
    @action(detail=False, methods=['get'])
    def urgent(self, request):
        """Get urgent notices."""
        notices = self.get_queryset().filter(priority='urgent')
        serializer = self.get_serializer(notices, many=True)
        return Response(serializer.data)

    def perform_create(self, serializer):
        # Restriction: Student HR can only target 'students' or 'all'
        target = self.request.data.get('target_audience')
        if self.request.user.groups.filter(name='Student_HR').exists():
            if target not in ['students', 'all']:
                target = 'students'
        
        notice = serializer.save(author=self.request.user, target_audience=target or 'all')

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
