"""Base model classes."""

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

class AuditableModelMixin:
    """Mixin to provide high-fidelity institutional audit logging."""
    def log_action(self, action, user=None, changes=None, request=None):
        from core.audit import log_action as core_log_action
        core_log_action(user, action, self, changes=changes, request=request)

class TimestampedModel(models.Model):
    """Base model with timestamp fields."""
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True, default=None, db_index=True)
    
    class Meta:
        abstract = True
    
    def soft_delete(self):
        """Soft delete the instance."""
        self.deleted_at = timezone.now()
        self.save()
    
    def restore(self):
        """Restore a soft-deleted instance."""
        self.deleted_at = None
        self.save()

class TenantModel(TimestampedModel, AuditableModelMixin):
    """Authority base class for all multi-tenant institutional ERP entities."""
    college = models.ForeignKey(
        'colleges.College',
        on_delete=models.CASCADE,
        related_name="%(class)s_records"
    )

    class Meta:
        abstract = True


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
        self.update_or_create(
            key=scoped_key,
            defaults={"response_data": response_data, "expires_at": expires},
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

class UserFeedback(TimestampedModel):
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

class SystemIncident(TimestampedModel):
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
