"""Admin configuration for auth app."""

from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField

from apps.auth.models import User
from core.constants import UserRoles


class UserCreationAdminForm(forms.ModelForm):
    """Admin form for creating users with password confirmation."""

    password1 = forms.CharField(label='Password', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Password confirmation', widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = (
            'username',
            'email',
            'registration_number',
            'first_name',
            'last_name',
            'phone_number',
            'role',
            'is_active',
            'is_staff',
            'is_superuser',
        )

    def clean(self):
        cleaned_data = super().clean()
        password1 = cleaned_data.get('password1')
        password2 = cleaned_data.get('password2')
        if password1 and password2 and password1 != password2:
            self.add_error('password2', 'Passwords do not match.')
        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)

        if not user.registration_number and user.username:
            user.registration_number = user.username

        if user.is_superuser:
            user.is_staff = True
            if not user.role:
                user.role = UserRoles.SUPER_ADMIN

        user.set_password(self.cleaned_data['password1'])

        if commit:
            user.save()
            self.save_m2m()
        return user


class UserChangeAdminForm(forms.ModelForm):
    """Admin form for editing users while exposing safe password-change link."""

    password = ReadOnlyPasswordHashField(
        label='Password',
        help_text='Raw passwords are not stored, so there is no way to see this user\'s password. '
        'Use the password change form linked from this field.'
    )

    class Meta:
        model = User
        fields = '__all__'

    def clean_password(self):
        return self.initial.get('password')

    def save(self, commit=True):
        user = super().save(commit=False)
        if user.is_superuser:
            user.is_staff = True
            if not user.role:
                user.role = UserRoles.SUPER_ADMIN
        if commit:
            user.save()
            self.save_m2m()
        return user


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = UserChangeAdminForm
    add_form = UserCreationAdminForm

    list_display = ['id', 'username', 'email', 'role', 'is_active', 'created_at']
    list_filter = ['role', 'is_active', 'created_at']
    search_fields = ['username', 'email', 'registration_number']
    readonly_fields = ['created_at', 'updated_at', 'last_login']

    ordering = ['-created_at']

    fieldsets = (
        (None, {
            'fields': ('username', 'password')
        }),
        ('Personal Info', {
            'fields': ('email', 'first_name', 'last_name', 'phone_number', 'profile_picture')
        }),
        ('Registration', {
            'fields': ('registration_number', 'role')
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')
        }),
        ('Important dates', {
            'fields': ('last_login',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'username',
                'email',
                'registration_number',
                'password1',
                'password2',
                'first_name',
                'last_name',
                'phone_number',
                'role',
                'is_active',
                'is_staff',
                'is_superuser',
            ),
        }),
    )

    filter_horizontal = ('groups', 'user_permissions', 'assigned_blocks')

    def save_model(self, request, obj, form, change):
        # Keep permission flags internally consistent.
        if obj.is_superuser and not obj.is_staff:
            obj.is_staff = True
        if obj.is_superuser and not obj.role:
            obj.role = UserRoles.SUPER_ADMIN
        super().save_model(request, obj, form, change)
