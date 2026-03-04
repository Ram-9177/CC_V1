"""Colleges views."""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin, IsTopLevel
from .models import College
from .serializers import CollegeSerializer


class CollegeViewSet(viewsets.ModelViewSet):
    """ViewSet for College management."""
    
    queryset = College.objects.all()
    serializer_class = CollegeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        """Only admins can create/update."""
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'toggle_active']:
            permission_classes = [IsTopLevel]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle a college's active status. Super Admin only.
        
        When a college is disabled:
        - All users of that college cannot login
        - Already-authenticated users get blocked by middleware
        - A specific message is shown to the user
        """
        college = self.get_object()
        
        # Only super_admin can toggle
        if request.user.role != 'super_admin' and not request.user.is_superuser:
            return Response(
                {'detail': 'Only Super Admins can enable/disable colleges.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        old_status = college.is_active
        college.is_active = not college.is_active
        college.disabled_reason = request.data.get('reason', '') if not college.is_active else ''
        college.save(update_fields=['is_active', 'disabled_reason', 'updated_at'])
        
        status_text = 'enabled' if college.is_active else 'disabled'
        user_count = college.users.filter(is_active=True).count()
        
        # Audit log
        from core.audit import log_action
        log_action(request.user, 'UPDATE', college, changes={
            'is_active': [old_status, college.is_active],
            'action': f'college_{status_text}',
            'affected_users': user_count,
            'reason': college.disabled_reason,
        }, request=request)
        
        return Response({
            'detail': f'College "{college.name}" has been {status_text}. {user_count} active users affected.',
            'is_active': college.is_active,
            'affected_users': user_count,
        })
