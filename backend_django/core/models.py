"""Base model classes."""

from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.core.serializers.json import DjangoJSONEncoder
import json


from core.constants import AudienceTargets

class TargetedCommunicationModel(models.Model):
    """Mixin to add target audience tracking to any communication model."""
    target_audience = models.CharField(
        max_length=50,
        choices=AudienceTargets.CHOICES + [('all', 'Everyone')], # Keep 'all' for backward compatibility in Notices
        default=AudienceTargets.ALL_STUDENTS
    )

    class Meta:
        abstract = True

import uuid
import logging

logger = logging.getLogger(__name__)

class AuditableModelMixin:
    """Mixin to provide high-fidelity institutional audit logging."""
    def log_action(self, action, user=None, changes=None, request=None):
        from core.audit import log_action as core_log_action
        core_log_action(user, action, self, changes=changes, request=request)


class ScopedQuerySet(models.QuerySet):
    """
    Extends QuerySet with institutional scoping capabilities.
    Enforces 'God-Level' dynamic data isolation.
    """

    def scoped(self, user, module_slug: str):
        """
        Filters the queryset based on the user's DB-recorded scope for the module.
        """
        if not user or not user.is_authenticated:
            return self.none()
        
        # 1. Mandatory Tenant Isolation (Hardened)
        tenant_id = getattr(user, 'college_id', None)
        field_names = {field.name for field in self.model._meta.get_fields()}
        if 'college' in field_names:
            qs = self.filter(college_id=tenant_id)
        elif 'tenant_id' in field_names:
            qs = self.filter(tenant_id=str(tenant_id))
        else:
            qs = self

        # 2. Bypass for platform super_admin and Django superuser
        from core.permissions import user_is_super_admin

        if user_is_super_admin(user):
            return qs

        # 3. Resolve Scope from RBAC 2.0
        try:
            from apps.rbac.models import RolePermission
            role_slug = getattr(user, 'role', None)
            perm = RolePermission.objects.get(role__slug=role_slug, module__slug=module_slug)
            
            if not perm.is_scoped:
                return qs # Global college access
            
            if perm.scope_type == 'personal':
                # Personal scope linked to student_id or owner_id
                if hasattr(self.model, 'student_id'):
                    return qs.filter(student_id=user.id)
                elif hasattr(self.model, 'user_id'):
                    return qs.filter(user_id=user.id)
                return qs.none()

            # 4. Hierarchical Scoping (Building/Floor)
            if perm.scope_type == 'building':
                # Reuses assigned_blocks relation from User model
                from core.role_scopes import get_warden_building_ids
                buildings = get_warden_building_ids(user)
                if hasattr(self.model, 'building_id'):
                    return qs.filter(building_id__in=buildings)
                elif hasattr(self.model, 'room__building_id'):
                    return qs.filter(room__building_id__in=buildings)
                
            if perm.scope_type == 'floor':
                # Reuses assigned_floors from User model
                from core.role_scopes import get_hr_floor_numbers
                floors = get_hr_floor_numbers(user)
                if hasattr(self.model, 'floor'):
                    return qs.filter(floor__in=floors)
                elif hasattr(self.model, 'room__floor'):
                    return qs.filter(room__floor__in=floors)

        except Exception as e:
            logger.warning(f"ScopedManager fallthrough for user {user.id} on {module_slug}: {str(e)}")
            # Fallback to hardcoded scopes if DB mapping fails (RBAC 1.5 Compatibility)
            return qs

        return qs


class ScopedManager(models.Manager):
    """Custom manager for Scoped models."""
    def get_queryset(self):
        return ScopedQuerySet(self.model, using=self._db)

    def scoped(self, user, module_slug: str):
        return self.get_queryset().scoped(user, module_slug)


class CampusBaseModel(models.Model):
    """
    Global Base Model for CampusCore.
    Enforces UUIDs, Tenant Isolation, and Soft Deletes universally across all domains.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trace_id = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True, help_text="Global Trace ID for request correlation.")
    # The tenant_id will tie into the TenantManager for strict query isolation
    tenant_id = models.CharField(max_length=100, db_index=True, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    class Meta:
        abstract = True
    
    objects = ScopedManager()

    def _sync_tenant_context(self):
        """Keep tenant_id aligned with the authoritative college FK when present."""
        field_names = {field.name for field in self._meta.get_fields()}
        if 'college' not in field_names:
            return

        college_id = getattr(self, 'college_id', None)
        self.tenant_id = str(college_id) if college_id else None

    def clean(self):
        super().clean()

        field_names = {field.name for field in self._meta.get_fields()}
        if 'college' not in field_names:
            return

        college_id = getattr(self, 'college_id', None)
        expected_tenant_id = str(college_id) if college_id else None
        if self.tenant_id != expected_tenant_id:
            raise ValidationError({'tenant_id': 'tenant_id must match the assigned college.'})

    def save(self, *args, **kwargs):
        self._sync_tenant_context()
        return super().save(*args, **kwargs)
    
    def soft_delete(self):
        """Soft delete the instance."""
        self.is_deleted = True
        update_fields = ['is_deleted']
        model_fields = {f.name for f in self._meta.get_fields()}
        if 'deleted_at' in model_fields:
            self.deleted_at = timezone.now()
            update_fields.append('deleted_at')
        self.save(update_fields=update_fields)
    
    def restore(self):
        """Restore a soft-deleted instance."""
        self.is_deleted = False
        update_fields = ['is_deleted']
        model_fields = {f.name for f in self._meta.get_fields()}
        if 'deleted_at' in model_fields:
            self.deleted_at = None
            update_fields.append('deleted_at')
        self.save(update_fields=update_fields)

class TenantModel(CampusBaseModel, AuditableModelMixin):
    """Authority base class for all multi-tenant institutional ERP entities."""
    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name="%(class)s_records",
        null=True,
        blank=True
    )

    class Meta:
        abstract = True

# Alias for backward compatibility during migration
TimestampedModel = CampusBaseModel


# ─────────────────────────────────────────────────────────────────────────────
# Idempotency Key
# ─────────────────────────────────────────────────────────────────────────────

class IdempotencyKeyManager(models.Manager):
    """Manager with helper for acquiring a key (atomic upsert)."""

    def get_or_create_response(self, key: str, user_id: int, ttl_seconds: int = 86400):
        """
        Check if this key was already used. If yes, return (cached_response, False).
        If no, return (None, True) — caller should process and then call .mark_done().

        Args:
            key:         The idempotency key string (from request header or body).
            user_id:     The requesting user's ID. Prevents cross-user key collisions.
            ttl_seconds: Auto-expire stale keys after this many seconds (default 24h).

        Returns:
            (response_data | None, is_new: bool)
        """
        scoped_key = f"{user_id}:{key}"

        # Purge expired keys lazily (amortized cost, no cron needed)
        self.filter(expires_at__lt=timezone.now()).delete()

        try:
            record = self.get(key=scoped_key)
            # Key already exists — return cached response
            return record.response_data, False
        except self.model.DoesNotExist:
            pass

        # New key — do not insert yet; caller generates the response first
        return None, True

    def mark_done(self, key: str, user_id: int, response_data: dict, ttl_seconds: int = 86400):
        """
        Persist the key and its response so subsequent requests with the same key
        receive the same response without re-executing the action.
        """
        scoped_key = f"{user_id}:{key}"
        expires = timezone.now() + timezone.timedelta(seconds=ttl_seconds)

        # Normalize payload to JSON-safe structure (UUID/datetime/ErrorDetail safe)
        try:
            serialized = json.dumps(response_data, cls=DjangoJSONEncoder)
            safe_response_data = json.loads(serialized)
        except Exception:
            safe_response_data = {"detail": str(response_data)}

        self.update_or_create(
            key=scoped_key,
            defaults={"response_data": safe_response_data, "expires_at": expires},
        )


class IdempotencyKey(models.Model):
    """
    Prevents duplicate execution of non-idempotent API actions.

    Usage pattern (in a view):

        from core.models import IdempotencyKey

        idem_key = request.headers.get("Idempotency-Key")
        if idem_key:
            cached, is_new = IdempotencyKey.objects.get_or_create_response(
                idem_key, request.user.id
            )
            if not is_new:
                return Response(cached, status=200)   # Replay previous response

        # ... perform the real action ...

        if idem_key:
            IdempotencyKey.objects.mark_done(idem_key, request.user.id, response.data)

    Covered actions (send Idempotency-Key header from frontend):
        - Gate pass approval / rejection
        - Complaint creation
        - Room allocation
    """

    key = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        help_text="Scoped key: '<user_id>:<client_key>'",
    )
    response_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Cached API response for replay.",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(
        db_index=True,
        help_text="Key is automatically purged after this time.",
    )

    objects = IdempotencyKeyManager()

    class Meta:
        app_label = "core"
        verbose_name = "Idempotency Key"
        verbose_name_plural = "Idempotency Keys"
        indexes = [
            models.Index(fields=["key"]),
            models.Index(fields=["expires_at"]),
        ]

    def __str__(self):
        return f"IdemKey({self.key}, expires={self.expires_at.date()})"
# ── Phase 7 Rollout & Feedback ──────────────────────────────────────────

class UserFeedback(CampusBaseModel):
    """Real-world feedback/bug report loop (Phase 7)."""
    FEEDBACK_CATEGORIES = [
        ('bug', 'Bug Report'),
        ('ui', 'UI/UX Confusion'),
        ('feature', 'Feature Request'),
        ('performance', 'Slow / Delays'),
        ('other', 'Other'),
    ]
    
    user = models.ForeignKey('hostelconnect_auth.User', on_delete=models.CASCADE, related_name='feedback_reports')
    college = models.ForeignKey('colleges.College', on_delete=models.SET_NULL, null=True, blank=True)
    category = models.CharField(max_length=20, choices=FEEDBACK_CATEGORIES, default='bug')
    subject = models.CharField(max_length=200)
    message = models.TextField()
    url = models.URLField(blank=True, null=True, help_text="Page where issue occurred.")
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)
    admin_notes = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_resolved', 'category']),
            models.Index(fields=['college']),
        ]

class SystemIncident(CampusBaseModel):
    """Production incident log for institutional SLA compliance."""
    title = models.CharField(max_length=200)
    description = models.TextField()
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(null=True, blank=True)
    severity = models.CharField(
        max_length=20, 
        choices=[('low', 'Minor'), ('med', 'Service Degradation'), ('high', 'Outage')],
        default='low'
    )
    is_resolved = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-start_time']

# ─────────────────────────────────────────────────────────────────────────────
# Event Bus (Transactional Outbox)
# ─────────────────────────────────────────────────────────────────────────────
import uuid

class SystemEvent(models.Model):
    """
    Transactional outbox for system-wide events.
    Guarantees asynchronous reliability, priority routing, and auditability.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    trace_id = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True, help_text="Links Gateway, Logs, and Events")
    
    name = models.CharField(max_length=255, db_index=True)
    payload = models.JSONField(help_text="The event payload data.")
    payload_checksum = models.CharField(max_length=64, blank=True, null=True, help_text="SHA-256 hash of the payload for integrity verification.")
    
    # Execution Rules
    event_type = models.CharField(max_length=50, default='system', choices=[('system', 'System'), ('notification', 'Notification'), ('analytics', 'Analytics')])
    priority = models.CharField(max_length=20, default='medium', choices=[('high', 'High'), ('medium', 'Medium'), ('low', 'Low')])
    
    status = models.CharField(
        max_length=20, 
        choices=[('pending', 'Pending'), ('processed', 'Processed'), ('failed', 'Failed'), ('failed_permanent', 'Dead Letter Queue')],
        default='pending',
        db_index=True
    )
    retries = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = "System Event"
        verbose_name_plural = "System Events"

    def __str__(self):
        return f"Event({self.name}, status={self.status}, priority={self.priority})"
