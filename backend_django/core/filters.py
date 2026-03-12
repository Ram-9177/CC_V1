
from rest_framework import filters
from django.db.models import Q
from core.permissions import user_is_top_level_management, ROLE_WARDEN, ROLE_HR, ROLE_STUDENT
from core.role_scopes import get_warden_building_ids, get_hr_building_ids, get_hr_floor_numbers

class RoleScopeFilterBackend(filters.BaseFilterBackend):
    """
    Global-ready filter backend for enforcing strict data isolation.
    - Top Management: See everything.
    - Staff/Warden/HR: See only their assigned scope (Block/Floor).
    - Students: See ONLY their own data.
    """
    
    def filter_queryset(self, request, queryset, view):
        user = request.user
        if not user or not user.is_authenticated:
            return queryset.none()

        # 1. Management Bypass
        if user_is_top_level_management(user):
            return queryset

        model = queryset.model
        model_name = model.__name__.lower()

        # 2. Student Isolation: Strictly own data for all core models
        if user.role == ROLE_STUDENT:
            if hasattr(model, 'student'):
                return queryset.filter(student=user)
            if hasattr(model, 'user'):
                return queryset.filter(user=user)
            if model_name == 'user':
                return queryset.filter(id=user.id)
            return queryset.none()

        # 3. Warden/HR Scope Filtering
        if user.role in [ROLE_WARDEN, ROLE_HR] or getattr(user, 'is_student_hr', False):
            # If the model has a way to check building/floor
            # This is complex to automate perfectly, so we prioritize known relationships
            warden_buildings = get_warden_building_ids(user)
            hr_floors = get_hr_floor_numbers(user)

            if not warden_buildings:
                return queryset.none()

            # Attempt to filter by room allocation linkage
            # Note: This assumes models like GatePass, Attendance, Complaint have a 'student' field linked to User
            if hasattr(model, 'student'):
                filter_q = Q(student__room_allocations__room__building_id__in=warden_buildings, student__room_allocations__end_date__isnull=True)
                if hr_floors and user.role == ROLE_HR:
                   filter_q &= Q(student__room_allocations__room__floor__in=hr_floors)
                return queryset.filter(filter_q).distinct()
            
            if hasattr(model, 'user'):
                filter_q = Q(user__room_allocations__room__building_id__in=warden_buildings, user__room_allocations__end_date__isnull=True)
                if hr_floors and user.role == ROLE_HR:
                   filter_q &= Q(user__room_allocations__room__floor__in=hr_floors)
                return queryset.filter(filter_q).distinct()

        return queryset

class AudienceFilterMixin:
    """Mixin to provide consistent target_audience filtering logic."""
    
    def filter_audience(self, request, queryset):
        user = request.user
        if not user or not user.is_authenticated:
            return queryset.none()
            
        # Top management sees everything
        if user_is_top_level_management(user):
            return queryset
            
        from django.db.models import Q
        from core.constants import AudienceTargets
        
        # Base filter: 'all' or 'all_students'
        audience_q = Q(target_audience__in=['all', AudienceTargets.ALL_STUDENTS])
        
        # Add student_type specific matching
        if user.role == ROLE_STUDENT:
            if hasattr(user, 'student_type'):
                if user.student_type == 'hosteller':
                    audience_q |= Q(target_audience=AudienceTargets.HOSTELLERS)
                elif user.student_type == 'day_scholar':
                    audience_q |= Q(target_audience=AudienceTargets.DAY_SCHOLARS)
        
        # Add role-specific matching for non-students (staff see all by default or specific tags)
        # Note: Notices have specific tags like 'wardens', 'chefs', etc.
        if user.role == ROLE_WARDEN:
            audience_q |= Q(target_audience='wardens') | Q(target_audience='staff')
        elif user.role in ['chef', 'head_chef']:
            audience_q |= Q(target_audience='chefs') | Q(target_audience='staff')
        elif user.role == 'staff':
            audience_q |= Q(target_audience='staff')
            
        return queryset.filter(audience_q)
