"""Base model classes."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.utils import timezone

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
            scope_field_names = {field.name for field in self.model._meta.get_fields()}
            
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
                from core.role_scopes import get_warden_building_ids
                buildings = get_warden_building_ids(user)
                if 'building' in scope_field_names:
                    return qs.filter(building_id__in=buildings)
                if 'room' in scope_field_names:
                    return qs.filter(room__building_id__in=buildings)
                
            if perm.scope_type == 'floor':
                from core.role_scopes import build_scoped_building_floor_q
                if {'building', 'floor'}.issubset(scope_field_names):
                    return qs.filter(
                        build_scoped_building_floor_q(
                            user,
                            building_lookup='building_id',
                            floor_lookup='floor',
                        )
                    )
                if 'room' in scope_field_names:
                    return qs.filter(
                        build_scoped_building_floor_q(
                            user,
                            building_lookup='room__building_id',
                            floor_lookup='room__floor',
                        )
                    )

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

def _idem_cache_key(scoped_key: str) -> str:
    return f"idem:v1:{scoped_key}"


class IdempotencyKeyManager(models.Manager):
    """Manager with helper for acquiring a key (atomic upsert)."""

    def get_or_create_response(self, key: str, user_id, ttl_seconds: int = 86400):
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

        ck = _idem_cache_key(scoped_key)
        try:
            cached_raw = cache.get(ck)
            if cached_raw is not None:
                return cached_raw, False
        except Exception:
            logger.warning("Idempotency cache read failed for %s", scoped_key, exc_info=True)

        try:
            record = self.get(key=scoped_key)
            # Key already exists — return cached response
            try:
                cache.set(ck, record.response_data, timeout=ttl_seconds)
            except Exception:
                logger.warning("Idempotency cache write failed for %s", scoped_key, exc_info=True)
            return record.response_data, False
        except self.model.DoesNotExist:
            pass

        # New key — do not insert yet; caller generates the response first
        return None, True

    def mark_done(
        self,
        key: str,
        user_id,
        response_data: dict,
        ttl_seconds: int = 86400,
        *,
        request_body_sha256: str | None = None,
    ):
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

        defaults = {"response_data": safe_response_data, "expires_at": expires}
        if request_body_sha256 is not None:
            defaults["request_body_sha256"] = request_body_sha256

        self.update_or_create(
            key=scoped_key,
            defaults=defaults,
        )
        try:
            cache.set(_idem_cache_key(scoped_key), safe_response_data, timeout=ttl_seconds)
        except Exception:
            logger.warning("Idempotency cache write failed for %s", scoped_key, exc_info=True)

    def _idem_payload_conflict(
        self,
        stored_sha256: str | None,
        request_body_sha256: str | None,
    ) -> bool:
        """True if a stored hash exists and the incoming body hash does not match."""
        if not stored_sha256:
            return False
        if request_body_sha256 is None:
            return False
        return stored_sha256 != request_body_sha256

    def replay_for_write(
        self,
        key: str,
        user_id,
        ttl_seconds: int = 86400,
        *,
        request_body_sha256: str | None = None,
    ) -> tuple[Any, int] | None | str:
        """
        Return (response_body, http_status) if replay is allowed, None if no key,
        or 'conflict' if the same idempotency key was used with a different body.
        """
        scoped_key = f"{user_id}:{key}"
        self.filter(expires_at__lt=timezone.now()).delete()

        def _decode(payload) -> tuple[Any, int] | None:
            if not isinstance(payload, dict):
                return None
            if payload.get("__cc_idem_v2__") is True and "__body__" in payload:
                st = int(payload.get("__status__", 200))
                body = payload.get("__body__")
                return (body, st)
            return (payload, 200)

        def _hash_from_cached_payload(payload) -> str | None:
            if isinstance(payload, dict) and payload.get("__cc_idem_v2__") is True:
                h = payload.get("__request_hash__")
                return h if isinstance(h, str) and len(h) == 64 else None
            return None

        ck = _idem_cache_key(scoped_key)
        try:
            cached_raw = cache.get(ck)
            if cached_raw is not None:
                cached_hash = _hash_from_cached_payload(cached_raw)
                if self._idem_payload_conflict(cached_hash, request_body_sha256):
                    return "conflict"
                decoded = _decode(cached_raw)
                if decoded:
                    return decoded
        except Exception:
            logger.warning("Idempotency cache read failed for %s", scoped_key, exc_info=True)

        try:
            record = self.get(key=scoped_key)
            stored = record.request_body_sha256
            if self._idem_payload_conflict(stored, request_body_sha256):
                return "conflict"
            decoded = _decode(record.response_data)
            if decoded:
                try:
                    cache.set(ck, record.response_data, timeout=ttl_seconds)
                except Exception:
                    logger.warning("Idempotency cache write failed for %s", scoped_key, exc_info=True)
                return decoded
        except self.model.DoesNotExist:
            pass
        return None

    def store_write(
        self,
        key: str,
        user_id,
        body: Any,
        http_status: int,
        ttl_seconds: int = 86400,
        *,
        request_body_sha256: str | None = None,
    ) -> None:
        """Persist successful write response for idempotent replay (body + HTTP status)."""
        scoped_key = f"{user_id}:{key}"
        expires = timezone.now() + timezone.timedelta(seconds=ttl_seconds)
        wrapper = {
            "__cc_idem_v2__": True,
            "__body__": body,
            "__status__": int(http_status),
            "__request_hash__": request_body_sha256 or "",
        }
        try:
            serialized = json.dumps(wrapper, cls=DjangoJSONEncoder)
            safe_wrapper = json.loads(serialized)
        except Exception:
            safe_wrapper = {
                "__cc_idem_v2__": True,
                "__body__": {"detail": str(body)},
                "__status__": int(http_status),
                "__request_hash__": request_body_sha256 or "",
            }

        sw_defaults: dict[str, Any] = {"response_data": safe_wrapper, "expires_at": expires}
        if request_body_sha256 is not None:
            sw_defaults["request_body_sha256"] = request_body_sha256
        self.update_or_create(
            key=scoped_key,
            defaults=sw_defaults,
        )
        try:
            cache.set(_idem_cache_key(scoped_key), safe_wrapper, timeout=ttl_seconds)
        except Exception:
            logger.warning("Idempotency cache write failed for %s", scoped_key, exc_info=True)


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
    request_body_sha256 = models.CharField(
        max_length=64,
        blank=True,
        null=True,
        db_index=True,
        help_text="SHA-256 hex of request body when key was completed; replay requires match.",
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
        indexes = [
            models.Index(
                fields=['status', 'priority', '-created_at'],
                name='core_sysevent_st_pri_crtd_idx',
            ),
        ]

    def __str__(self):
        return f"Event({self.name}, status={self.status}, priority={self.priority})"


class SystemEventDelivery(models.Model):
    """Per-channel delivery tracking for a system event (additive; does not replace outbox status)."""

    CHANNEL_WEBSOCKET = 'websocket'
    CHANNEL_PUSH = 'push'
    CHANNEL_EMAIL = 'email'
    CHANNEL_OTHER = 'other'
    CHANNEL_CHOICES = [
        (CHANNEL_WEBSOCKET, 'WebSocket'),
        (CHANNEL_PUSH, 'Push'),
        (CHANNEL_EMAIL, 'Email'),
        (CHANNEL_OTHER, 'Other'),
    ]

    STATUS_PENDING = 'pending'
    STATUS_SENT = 'sent'
    STATUS_FAILED = 'failed'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_SENT, 'Sent'),
        (STATUS_FAILED, 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    system_event = models.ForeignKey(
        SystemEvent,
        on_delete=models.CASCADE,
        related_name='channel_deliveries',
    )
    channel = models.CharField(max_length=32, choices=CHANNEL_CHOICES, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_PENDING,
        db_index=True,
    )
    attempts = models.PositiveIntegerField(default=0)
    last_error = models.TextField(blank=True)
    tenant_id = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='system_event_deliveries',
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'core'
        verbose_name = 'System Event Delivery'
        verbose_name_plural = 'System Event Deliveries'
        indexes = [
            models.Index(fields=['system_event', 'channel'], name='core_sysev_del_ev_ch_idx'),
        ]

    def __str__(self):
        return f"Delivery({self.system_event_id}, {self.channel}, {self.status})"


class SystemEventLog(models.Model):
    """Immutable append-only log rows for system event lifecycle (insert-only from application code)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    system_event = models.ForeignKey(
        SystemEvent,
        on_delete=models.CASCADE,
        related_name='immutable_logs',
    )
    action = models.CharField(max_length=64, db_index=True)
    detail = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        app_label = 'core'
        ordering = ['created_at']
        verbose_name = 'System Event Log'
        verbose_name_plural = 'System Event Logs'
        indexes = [
            models.Index(fields=['system_event', 'created_at'], name='core_sysev_log_ev_crtd_idx'),
        ]

    def __str__(self):
        return f"EventLog({self.system_event_id}, {self.action})"
