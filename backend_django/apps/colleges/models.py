"""Colleges app models."""

from django.db import models
from core.models import TimestampedModel


class College(TimestampedModel):
    """Model for colleges/universities.

    SaaS fields
    -----------
    subscription_status : tier of the college's SaaS plan
    max_users           : hard cap on total users (0 = unlimited)
    logo                : college logo shown in the app header
    primary_color       : hex colour for light branding
    """

    SUBSCRIPTION_CHOICES = [
        ('free', 'Free'),
        ('starter', 'Starter'),
        ('pro', 'Pro'),
        ('enterprise', 'Enterprise'),
    ]

    name = models.CharField(max_length=200, unique=True)
    code = models.CharField(max_length=50, unique=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)
    is_active = models.BooleanField(
        default=True,
        help_text="When disabled, all users of this college are locked out of the system."
    )
    disabled_reason = models.CharField(
        max_length=500, blank=True, default='',
        help_text="Optional message shown to users when their college is disabled."
    )

    # ── SaaS & Billing Layer (Commercial Readiness) ──────────────────────────
    subscription_status = models.CharField(
        max_length=20,
        choices=SUBSCRIPTION_CHOICES,
        default='free',
        db_index=True,
        help_text='SaaS subscription tier for this college.',
    )
    trial_ends_at = models.DateTimeField(null=True, blank=True, help_text="End of free trial period.")
    
    # Usage Quotas
    max_users = models.PositiveIntegerField(default=0, help_text='Maximum total users allowed (0 = unlimited).')
    max_storage_mib = models.PositiveIntegerField(default=500, help_text='Storage limit in MiB.')
    max_monthly_emails = models.PositiveIntegerField(default=1000)
    max_monthly_sms = models.PositiveIntegerField(default=100)
    
    # Current Usage (Snapshots, updated via background tasks)
    current_storage_bytes = models.BigIntegerField(default=0)
    
    # Feature Flags
    is_whitelabel_enabled = models.BooleanField(default=False)
    has_api_access = models.BooleanField(default=False)
    
    logo = models.ImageField(
        upload_to='college_logos/',
        null=True, blank=True,
        help_text='College logo shown in the app header.',
    )
    primary_color = models.CharField(
        max_length=7, blank=True, default='',
        help_text='Hex colour code for light branding (e.g. #6366F1).',
    )

    class Meta:
        ordering = ['name']
        db_table = 'colleges_college'
        indexes = [
            models.Index(fields=['is_active', 'subscription_status']),
            models.Index(fields=['code']),
        ]

    def __str__(self):
        status = '' if self.is_active else ' [DISABLED]'
        return f"{self.name}{status}"

    # ── Helpers ───────────────────────────────────────────────────────────────

    def is_module_enabled(self, module_name: str) -> bool:
        """Return True if *module_name* is enabled for this college.

        Defaults to True when no explicit config row exists (opt-out model).
        """
        try:
            cfg = self.module_configs.get(module_name=module_name)
            return cfg.is_enabled
        except CollegeModuleConfig.DoesNotExist:
            return True

    def user_count(self) -> int:
        return self.users.count()

    def is_at_user_limit(self) -> bool:
        """Return True when max_users is set and the college has reached it."""
        if self.max_users == 0:
            return False
        return self.users.count() >= self.max_users


class CollegeModuleConfig(models.Model):
    """Per-college module enable/disable switch.

    When a row is absent the module is considered enabled (opt-out model).
    Super Admin or College Admin can create/update rows via the API.
    """

    college = models.ForeignKey(
        College,
        on_delete=models.CASCADE,
        related_name='module_configs',
    )
    module_name = models.CharField(
        max_length=50,
        help_text='Module slug matching core.rbac module constants (e.g. hostel, sports, hall).',
    )
    is_enabled = models.BooleanField(
        default=True,
        help_text='When False, all API access to this module is blocked for this college.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'colleges_moduleconfig'
        ordering = ['college', 'module_name']
        unique_together = [('college', 'module_name')]

    def __str__(self):
        state = 'ON' if self.is_enabled else 'OFF'
        return f"{self.college.code} / {self.module_name} [{state}]"

class ExternalIntegration(TimestampedModel):
    """External API access for 3rd-party campus tools (Phase 8)."""
    college = models.ForeignKey(College, on_delete=models.CASCADE, related_name='integrations')
    name = models.CharField(max_length=100, help_text="e.g. 'College Official Website'")
    api_key_hash = models.CharField(max_length=255, unique=True)
    webhook_url = models.URLField(blank=True, null=True, help_text="URL to notify on campus events.")
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        db_table = 'colleges_integration'
        unique_together = [('college', 'name')]

    @staticmethod
    def generate_api_key():
        import secrets
        return secrets.token_urlsafe(32)
class CollegePolicy(TimestampedModel):
    """Institutional business rules/policies for ERP scaling."""
    college = models.OneToOneField(College, on_delete=models.CASCADE, related_name='policy')
    
    # Gatepass Policies
    gatepass_auto_expire_hours = models.PositiveIntegerField(default=24, help_text="Hours after which an exit becomes an auto-late return.")
    gatepass_late_fine_per_hour = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Attendance Policies
    attendance_reporting_time = models.TimeField(null=True, blank=True, help_text="Time to auto-generate absence alerts.")
    
    # Safety Policies
    emergency_contact_required = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'colleges_policy'
        verbose_name_plural = 'College Policies'

    def __str__(self):
        return f"Policy for {self.college.code}"
