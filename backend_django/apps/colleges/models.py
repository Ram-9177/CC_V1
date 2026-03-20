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

    # ── SaaS fields ───────────────────────────────────────────────────────────
    subscription_status = models.CharField(
        max_length=20,
        choices=SUBSCRIPTION_CHOICES,
        default='free',
        help_text='SaaS subscription tier for this college.',
    )
    max_users = models.PositiveIntegerField(
        default=0,
        help_text='Maximum total users allowed (0 = unlimited).',
    )
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
