from core.views.base import CollegeModelViewSet
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogViewSet(CollegeModelViewSet):
    """
    Forensic Audit Log ViewSet.
    Restricted to Platform/Super Admins and Institutional Management.
    """
    queryset = AuditLog.objects.select_related('actor', 'college').all()
    serializer_class = AuditLogSerializer
    rbac_module = 'audit'
    rbac_capability = 'view'

    # Standard DRF filtering
    from django_filters.rest_framework import DjangoFilterBackend
    from rest_framework import filters
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action', 'resource_type']
    search_fields = ['resource_id', 'actor__username', 'actor__first_name', 'actor__last_name']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        
        # User defined overrides handled by filter_backends but we keep these manual ones too
        actor_id = self.request.query_params.get('actor_id')
        if actor_id:
            qs = qs.filter(actor_id=actor_id)
            
        resource_type = self.request.query_params.get('resource_type')
        if resource_type:
            qs = qs.filter(resource_type=resource_type)
            
        return qs
