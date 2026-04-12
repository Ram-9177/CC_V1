"""Feedback loop views for Phase 7 launches."""
from rest_framework import viewsets, mixins, permissions, status
from rest_framework.response import Response
from core.models import UserFeedback, SystemIncident
from core.constants import ROLE_SUPER_ADMIN
from .serializers import UserFeedbackSerializer # I will create this next

class UserFeedbackViewSet(mixins.CreateModelMixin, 
                          mixins.ListModelMixin,
                          viewsets.GenericViewSet):
    """
    Public feedback loop (Phase 7).
    Allows all users to report bugs or friction directly from the UI.
    """
    queryset = UserFeedback.objects.all()
    serializer_class = UserFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Platform Admins see all; others see only their own Feedback
        user = self.request.user
        if getattr(user, 'role', '') in [ROLE_SUPER_ADMIN, 'platform_admin']:
            return UserFeedback.objects.all()
        return UserFeedback.objects.filter(user=user)

    def perform_create(self, serializer):
        # Auto-assign user and current college context
        serializer.save(
            user=self.request.user,
            college_id=self.request.user.college_id
        )

class SystemStatusViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Public Status Page API.
    Shows ongoing maintenance and recent incidents.
    """
    queryset = SystemIncident.objects.filter(is_resolved=False).order_by('-start_time')
    serializer_class = None # Or a simple serializer
    permission_classes = [permissions.AllowAny]

    def list(self, request, *args, **kwargs):
        incidents = self.get_queryset()
        data = [{
            'id': i.id,
            'title': i.title,
            'severity': i.severity,
            'start_time': i.start_time,
            'message': i.description
        } for i in incidents]
        
        return Response({
            'status': 'degraded' if incidents.filter(severity='high').exists() else 'operational',
            'incidents': data
        })
