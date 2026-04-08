"""Custom User model for authentication."""

from django.contrib.auth.models import AbstractUser
from django.db import models
from core.constants import ROLE_HR, ROLE_STUDENT, UserRoles
from core.models import TimestampedModel


class User(AbstractUser, TimestampedModel):
    """Extended User model with custom fields."""
    
    ROLE_CHOICES = [
        (UserRoles.STUDENT, 'Student'),
        (UserRoles.STAFF, 'Staff'),
        (UserRoles.ADMIN, 'Admin'),
        (UserRoles.SUPER_ADMIN, 'Super Admin'),
        (UserRoles.PRINCIPAL, 'Principal'),
        (UserRoles.DIRECTOR, 'Director'),
        (UserRoles.HOD, 'HOD'),
        (UserRoles.HEAD_WARDEN, 'Head Warden'),
        (UserRoles.WARDEN, 'Warden'),
        (UserRoles.INCHARGE, 'Incharge'),
        (UserRoles.CHEF, 'Chef'),
        (UserRoles.HEAD_CHEF, 'Head Chef'),
        (UserRoles.GATE_SECURITY, 'Gate Security'),
        (UserRoles.SECURITY_HEAD, 'Security Head'),
        (UserRoles.HR, 'HR Rep'),
        (UserRoles.PD, 'Physical Director'),
        (UserRoles.PT, 'Physical Trainer'),
        (UserRoles.ALUMNI, 'Alumni'),
    ]
    
    student_type = models.CharField(
        max_length=20,
        choices=[('hosteller', 'Hosteller'), ('day_scholar', 'Day Scholar')],
        default='hosteller',
        help_text='Indicates if the student resides in hostel or is a day scholar.'
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_STUDENT)
    phone_number = models.CharField(max_length=15, blank=True)
    registration_number = models.CharField(max_length=50, unique=True)
    profile_picture = models.ImageField(upload_to='profile_pictures/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_approved = models.BooleanField(default=True)
    is_password_changed = models.BooleanField(default=True)
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    college = models.ForeignKey('colleges.College', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    department = models.CharField(max_length=100, blank=True, default='')
    year = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Current year of study (1-5)")
    semester = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Current semester (1-10)")
    hostel = models.ForeignKey('rooms.Hostel', on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    late_count = models.PositiveIntegerField(default=0, help_text="Cumulative number of times the student returned late.")

    # HR & Warden Scope Assignments
    # Using 'apps.rooms.Building' to avoid circular imports if necessary
    assigned_blocks = models.ManyToManyField('rooms.Building', blank=True, related_name='assigned_staff')
    assigned_floors = models.JSONField(default=list, blank=True, help_text="List of floor numbers assigned to this HR/Warden")
    can_access_all_blocks = models.BooleanField(
        default=False,
        help_text="If enabled by Head Warden/Admin, this user can access all blocks in their college."
    )
    is_student_hr = models.BooleanField(default=False, help_text="Designates if this student has HR authority")
    
    # Campus Presence Tracking
    is_on_campus = models.BooleanField(default=False, help_text="Designates if this person is staying on campus")
    custom_location = models.CharField(max_length=255, blank=True, help_text="Custom location if not in a specific block (e.g., Rehab)")
    
    @property
    def is_hr(self):
        return self.role == ROLE_HR or self.is_student_hr

    def has_permission(self, module: str, capability: str) -> bool:
        """Check whether this user holds *capability* for *module*.

        Example::

            if user.has_permission("gatepass", "approve"):
                ...

        Delegates to the central RBAC engine in ``core.rbac``.
        """
        from core.rbac import has_module_permission
        return has_module_permission(self, module, capability)

    class Meta:
        ordering = ['-created_at']
        db_table = 'hostelconnect_user'
        indexes = [
            models.Index(fields=['phone_number']),
            models.Index(fields=['role']),
            models.Index(fields=['email']),
            models.Index(fields=['registration_number']),
            models.Index(fields=['role', 'is_active']),
            models.Index(fields=['college', 'role', 'is_active'], name='auth_user_col_role_act_idx'),
            models.Index(fields=['-created_at']),
        ]

    def clean(self):
        """Validate that email is provided."""
        if not self.email or not self.email.strip():
            raise models.ValidationError({'email': 'Email is required for all users.'})
        super().clean()

    def save(self, *args, **kwargs):
        # Normalize hall tickets/usernames and registration numbers to uppercase.
        if self.username:
            self.username = self.username.strip().upper()

        reg_no = (self.registration_number or '').strip()
        if not reg_no:
            reg_no = self.username or ''
        self.registration_number = reg_no.upper() if reg_no else reg_no

        # Keep registration_number usable even for admin-created/superusers.
        if not self.registration_number and self.username:
            self.registration_number = self.username
        super().save(*args, **kwargs)
    
    def __str__(self):
        name = (self.get_full_name() or '').strip() or self.username
        reg = (self.registration_number or '').strip() or self.username
        return f"{name} ({reg})"
