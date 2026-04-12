"""Operations app views — Phase 9."""

from rest_framework import viewsets, permissions, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.db import transaction
from django.db.models import Q

from core.college_mixin import CollegeScopeMixin
from core.permissions import user_is_super_admin
from core.event_service import EventService
from core.events import AppEvents
from .models import BulkUserJob, SystemConfig, AuditAction
from .serializers import BulkUserJobSerializer, SystemConfigSerializer, AuditActionSerializer
from apps.auth.models import User

class BulkOperationViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Scaling engine for bulk user management."""
    queryset = BulkUserJob.objects.all()
    serializer_class = BulkUserJobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        if not self.request.user.role in ['admin', 'super_admin']:
             raise PermissionDenied("Only admins can initiate bulk imports.")
        
        job = serializer.save(
            uploaded_by=self.request.user,
            college=self.request.user.college,
            status='pending'
        )
        
        EventService.emit(AppEvents.BULK_UPLOAD_STARTED, self.request.user, {"job_id": job.id})
        # Note: In a real production system, we call process_bulk_upload.delay(job.id) here.
        # For Phase 9 Logic, we assume the processing logic resides in a service.

class SystemConfigViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Central control registry for business rules."""
    queryset = SystemConfig.objects.all()
    serializer_class = SystemConfigSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_update(self, serializer):
        config = serializer.save()
        EventService.emit(AppEvents.CONFIG_UPDATED, self.request.user, {"key": config.key})

class AdminControlViewSet(viewsets.ViewSet):
    """Operational backbone: Role updates and Audit access."""
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def update_role(self, request):
        """Governance: Controlled role modification."""
        if not request.user.role in ['admin', 'super_admin']:
             raise PermissionDenied("Unauthorized: Governance action restricted.")

        target_user_id = request.data.get('user_id')
        new_role = request.data.get('role')
        
        try:
            target_user = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
             raise ValidationError("User not found.")

        # College admin: only users in the same tenant; cannot touch platform / owner accounts.
        if request.user.role == 'admin' and not user_is_super_admin(request.user):
            if not request.user.college_id:
                raise PermissionDenied("College assignment required for this action.")
            if target_user.college_id != request.user.college_id:
                raise PermissionDenied("You can only modify users in your college.")
            if getattr(target_user, 'is_superuser', False):
                raise PermissionDenied("Insufficient permissions for this user.")
            if target_user.role in ('admin', 'super_admin'):
                raise PermissionDenied("Only platform super admins can modify college owner accounts.")

        # Hierarchy enforcement: only super_admin can set admin role
        if new_role == 'admin' and not user_is_super_admin(request.user):
             raise PermissionDenied("Only Super Admins can promote users to Admin.")

        if new_role == 'super_admin' and not user_is_super_admin(request.user):
            raise PermissionDenied("Only Super Admins can assign the super_admin role.")

        old_role = target_user.role
        with transaction.atomic():
            target_user.role = new_role
            target_user.save()
            
            # Audit the sensitive change
            AuditAction.objects.create(
                actor=request.user,
                action='ROLE_CHANGE',
                entity_type='USER',
                entity_id=str(target_user.id),
                before_state={"role": old_role},
                after_state={"role": new_role},
                ip_address=request.META.get('REMOTE_ADDR')
            )
            
            EventService.emit(AppEvents.ROLE_CHANGED, target_user, {"old_role": old_role, "new_role": new_role})

        return Response({"status": f"User {target_user.username} role updated from {old_role} to {new_role}."})

    @action(detail=False, methods=['get'])
    def audit_trail(self, request):
        """Strict governance: System logs access."""
        if not request.user.role in ['admin', 'super_admin']:
            raise PermissionDenied("Audit trail access restricted.")

        logs = AuditAction.objects.select_related('actor', 'actor__college').order_by('-created_at')
        if request.user.role == 'admin' and not user_is_super_admin(request.user):
            if not request.user.college_id:
                return Response([])
            logs = logs.filter(actor__college_id=request.user.college_id)
        logs = logs[:100]
        return Response(AuditActionSerializer(logs, many=True).data)

    @action(detail=False, methods=['get'])
    def system_health(self, request):
        """Operational backbone: System vitals."""
        # Mock logic representing system health
        return Response({
            "status": "operational",
            "celery_queue_depth": 0,
            "api_vitals": "healthy",
            "database_load": "low"
        })
