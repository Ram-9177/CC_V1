"""Meals app views."""
from datetime import date

from django.db.models import Avg
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from apps.meals.models import (
    Meal,
    MealAttendance,
    MealFeedback,
    MealFeedbackResponse,
    MealPreference,
    MealSpecialRequest,
    MealWastage,
    MenuNotification,
)
from apps.meals.serializers import (
    MealAttendanceSerializer,
    MealFeedbackResponseSerializer,
    MealFeedbackSerializer,
    MealPreferenceSerializer,
    MealSerializer,
    MealSpecialRequestSerializer,
    MealWastageSerializer,
    MenuNotificationSerializer,
)
from core.college_mixin import CollegeScopeMixin
from core.permissions import IsAdmin, IsChef, IsHR
from core.permissions import IsStudent
from core.role_scopes import (
    get_hr_building_ids,
    get_hr_floor_numbers,
    get_warden_building_ids,
    user_is_top_level_management,
)
from core.services import compute_dining_forecast
from core.throttles import ActionScopedThrottleMixin


def _is_meal_authority(user) -> bool:
    if not getattr(user, 'is_authenticated', False):
        return False
    if user_is_top_level_management(user):
        return True
    if getattr(user, 'role', None) in {'warden', 'chef', 'head_chef', 'hr'}:
        return True
    return bool(getattr(user, 'is_student_hr', False))


def _apply_hostel_scope(queryset, user, relation_root: str):
    if not getattr(user, 'is_authenticated', False):
        return queryset.none()

    if user_is_top_level_management(user) or getattr(user, 'role', None) in {'chef', 'head_chef'}:
        return queryset

    if getattr(user, 'role', None) == 'warden':
        building_ids = get_warden_building_ids(user)
        if not building_ids:
            return queryset.none()
        return queryset.filter(
            **{
                f'{relation_root}__room_allocations__status': 'approved',
                f'{relation_root}__room_allocations__end_date__isnull': True,
                f'{relation_root}__room_allocations__room__building_id__in': building_ids,
            }
        ).distinct()

    if getattr(user, 'role', None) == 'hr' or getattr(user, 'is_student_hr', False):
        building_ids = get_hr_building_ids(user)
        if not building_ids:
            return queryset.none()
        queryset = queryset.filter(
            **{
                f'{relation_root}__room_allocations__status': 'approved',
                f'{relation_root}__room_allocations__end_date__isnull': True,
                f'{relation_root}__room_allocations__room__building_id__in': building_ids,
            }
        )
        floor_numbers = get_hr_floor_numbers(user)
        if floor_numbers:
            queryset = queryset.filter(
                **{f'{relation_root}__room_allocations__room__floor__in': floor_numbers}
            )
        return queryset.distinct()

    return queryset.filter(**{relation_root: user})


class MealViewSet(ActionScopedThrottleMixin, CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for meals, student meal actions, and dining self-service."""

    queryset = Meal.objects.prefetch_related('items', 'feedback').all()
    serializer_class = MealSerializer
    permission_classes = [permissions.IsAuthenticated]
    from core.pagination import StandardPagination
    pagination_class = StandardPagination
    action_throttle_scopes = {
        'mark_attendance': 'meal_attendance_mark',
        'mark': 'meal_attendance_mark',
    }

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'forecast']:
            return [permissions.IsAuthenticated(), (IsChef | IsAdmin | IsHR)()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        date_str = self.request.query_params.get('date')
        meal_type = self.request.query_params.get('meal_type')

        if date_str:
            queryset = queryset.filter(meal_date=date_str)
        if meal_type and meal_type != 'all':
            queryset = queryset.filter(meal_type=meal_type)

        return queryset.order_by('meal_date', 'meal_type')

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def forecast(self, request):
        """Get dining attendance forecast."""
        date_str = request.query_params.get('date')
        meal_type = request.query_params.get('meal_type')

        try:
            target_date = date.fromisoformat(date_str) if date_str else date.today()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        college_id = getattr(request.user, 'college_id', None)
        result = compute_dining_forecast(target_date, meal_type, college_id=college_id)
        return Response(result)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStudent])
    def mark_attendance(self, request, pk=None):
        """Mark the authenticated student's attendance for a specific meal."""
        if request.user.role != 'student':
            raise PermissionDenied('Only students can mark meal attendance.')
        meal = self.get_object()
        user = request.user
        attendance, created = MealAttendance.objects.get_or_create(
            meal=meal,
            student=user,
            defaults={
                'status': 'taken',
                'college': getattr(user, 'college', None),
            },
        )

        if not created:
            attendance.status = 'taken'
            attendance.save(update_fields=['status', 'updated_at'])

        return Response({'status': 'attendance marked'})

    @action(detail=False, methods=['get'], url_path='attendance', permission_classes=[permissions.IsAuthenticated])
    def attendance(self, request):
        """List meal attendance records for the current user or scoped authorities."""
        queryset = MealAttendance.objects.select_related('student', 'meal')
        date_str = request.query_params.get('date')
        meal_type = request.query_params.get('meal_type')

        if getattr(request.user, 'college', None):
            queryset = queryset.filter(college=request.user.college)
        if date_str:
            queryset = queryset.filter(meal__meal_date=date_str)
        if meal_type and meal_type != 'all':
            queryset = queryset.filter(meal__meal_type=meal_type)

        queryset = _apply_hostel_scope(queryset, request.user, 'student').order_by('-marked_at')
        serializer = MealAttendanceSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['post'], url_path='mark', permission_classes=[permissions.IsAuthenticated, IsStudent])
    def mark(self, request):
        """Create or update the authenticated student's meal attendance."""
        if request.user.role != 'student':
            raise PermissionDenied('Only students can mark meal attendance.')
        meal_id = request.data.get('meal_id')
        if not meal_id:
            raise ValidationError({'meal_id': 'meal_id is required.'})

        try:
            meal = self.get_queryset().get(id=meal_id)
        except Meal.DoesNotExist as exc:
            raise ValidationError({'meal_id': 'Meal not found.'}) from exc

        attended = request.data.get('attended')
        explicit_status = request.data.get('status')
        status_value = explicit_status or ('taken' if attended in [True, 'true', '1', 1] else 'skipped')
        if status_value not in {'taken', 'skipped'}:
            raise ValidationError({'status': 'status must be "taken" or "skipped".'})

        attendance, _ = MealAttendance.objects.update_or_create(
            meal=meal,
            student=request.user,
            defaults={
                'status': status_value,
                'college': getattr(request.user, 'college', None),
            },
        )
        serializer = MealAttendanceSerializer(attendance, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get', 'post'], url_path='preferences', permission_classes=[permissions.IsAuthenticated])
    def preferences(self, request):
        """Get or update the authenticated user's meal preferences."""
        queryset = MealPreference.objects.select_related('user').filter(user=request.user)

        if request.method.lower() == 'get':
            serializer = MealPreferenceSerializer(queryset.order_by('meal_type'), many=True)
            return Response(serializer.data)

        meal_type = request.data.get('meal_type')
        preference = request.data.get('preference')
        dietary_restrictions = request.data.get('dietary_restrictions')

        if not meal_type and dietary_restrictions is None:
            raise ValidationError({'meal_type': 'meal_type is required unless updating dietary_restrictions.'})

        meal_types = [meal_type] if meal_type else ['breakfast', 'lunch', 'dinner']
        updated_records = []

        for current_meal_type in meal_types:
            defaults = {'college': getattr(request.user, 'college', None)}
            if preference is not None:
                defaults['preference'] = preference
            if dietary_restrictions is not None:
                defaults['dietary_restrictions'] = dietary_restrictions

            pref_obj, created = MealPreference.objects.get_or_create(
                user=request.user,
                meal_type=current_meal_type,
                defaults=defaults,
            )

            fields_to_update = []
            if not created:
                if preference is not None and pref_obj.preference != preference:
                    pref_obj.preference = preference
                    fields_to_update.append('preference')
                if dietary_restrictions is not None and pref_obj.dietary_restrictions != dietary_restrictions:
                    pref_obj.dietary_restrictions = dietary_restrictions
                    fields_to_update.append('dietary_restrictions')
                if getattr(request.user, 'college', None) and pref_obj.college_id is None:
                    pref_obj.college = request.user.college
                    fields_to_update.append('college')
                if fields_to_update:
                    fields_to_update.append('updated_at')
                    pref_obj.save(update_fields=fields_to_update)

            updated_records.append(pref_obj)

        serializer = MealPreferenceSerializer(updated_records, many=True)
        payload = serializer.data
        return Response(payload[0] if len(payload) == 1 else payload, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='feedback-stats', permission_classes=[permissions.IsAuthenticated])
    def feedback_stats(self, request):
        """Return meal feedback summary for scoped authorities."""
        if not _is_meal_authority(request.user):
            raise PermissionDenied("Feedback stats are only available for hostel authorities.")

        queryset = MealFeedback.objects.select_related('meal', 'user').all()
        if getattr(request.user, 'college', None):
            queryset = queryset.filter(college=request.user.college)

        date_str = request.query_params.get('date')
        meal_type = request.query_params.get('meal_type')
        if date_str:
            queryset = queryset.filter(meal__meal_date=date_str)
        if meal_type and meal_type != 'all':
            queryset = queryset.filter(meal__meal_type=meal_type)

        queryset = _apply_hostel_scope(queryset, request.user, 'user')
        average_rating = queryset.aggregate(avg=Avg('rating'))['avg']

        return Response({
            'total_feedback': queryset.count(),
            'average_rating': average_rating or 0,
            'positive_count': queryset.filter(rating__gte=4).count(),
            'negative_count': queryset.filter(rating__lte=2).count(),
        })


class MealFeedbackViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for meal feedback."""

    queryset = MealFeedback.objects.select_related('user', 'meal').all()
    serializer_class = MealFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), (IsChef | IsAdmin | IsHR)()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        date_str = self.request.query_params.get('date')
        meal_type = self.request.query_params.get('meal_type')

        if date_str:
            queryset = queryset.filter(meal__meal_date=date_str)
        if meal_type and meal_type != 'all':
            queryset = queryset.filter(meal__meal_type=meal_type)

        return _apply_hostel_scope(queryset, self.request.user, 'user').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, college=getattr(self.request.user, 'college', None))

    def perform_update(self, serializer):
        save_kwargs = {}
        if serializer.validated_data.get('is_published_by_hr') and not serializer.instance.published_at:
            save_kwargs['published_at'] = timezone.now()
        serializer.save(**save_kwargs)


class EnhancedMealFeedbackViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Enhanced ViewSet for meal feedback analytics."""

    queryset = MealFeedback.objects.all()
    serializer_class = MealFeedbackSerializer
    permission_classes = [IsHR | IsAdmin]

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Get summary analytics for meal feedback."""
        college = getattr(request.user, 'college', None)
        queryset = MealFeedback.objects.filter(college=college) if college else MealFeedback.objects.none()
        avg_rating = queryset.aggregate(avg=Avg('rating'))['avg']
        return Response({
            'overall_average': avg_rating or 0,
            'total_responses': queryset.count(),
        })


class MenuNotificationViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for menu notifications."""

    queryset = MenuNotification.objects.all()
    serializer_class = MenuNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsChef()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if user_is_top_level_management(user) or getattr(user, 'role', None) in {'chef', 'head_chef'}:
            return queryset.order_by('-menu_date', '-created_at')

        return queryset.filter(status='published').order_by('-menu_date', '-created_at')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, college=getattr(self.request.user, 'college', None))


class MealSpecialRequestViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for special meal requests."""

    queryset = MealSpecialRequest.objects.select_related('student').all()
    serializer_class = MealSpecialRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if _is_meal_authority(user):
            return _apply_hostel_scope(queryset, user, 'student').order_by('-requested_for_date', '-created_at')

        return queryset.filter(student=user).order_by('-requested_for_date', '-created_at')

    def perform_create(self, serializer):
        serializer.save(student=self.request.user, college=getattr(self.request.user, 'college', None))

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        meal_request = self.get_object()
        if not _is_meal_authority(request.user):
            raise PermissionDenied("Only hostel authorities can approve special requests.")
        if meal_request.status != 'pending':
            return Response({'detail': f'Cannot approve a {meal_request.status} request.'}, status=status.HTTP_400_BAD_REQUEST)

        meal_request.status = 'approved'
        meal_request.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(meal_request).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        meal_request = self.get_object()
        if not _is_meal_authority(request.user):
            raise PermissionDenied("Only hostel authorities can reject special requests.")
        if meal_request.status != 'pending':
            return Response({'detail': f'Cannot reject a {meal_request.status} request.'}, status=status.HTTP_400_BAD_REQUEST)

        meal_request.status = 'rejected'
        meal_request.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(meal_request).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def deliver(self, request, pk=None):
        meal_request = self.get_object()
        if request.user.role not in {'chef', 'head_chef', 'admin', 'super_admin', 'head_warden', 'warden'}:
            raise PermissionDenied("Only kitchen or hostel authorities can mark delivery.")
        if meal_request.status != 'approved':
            return Response({'detail': f'Cannot deliver a {meal_request.status} request.'}, status=status.HTTP_400_BAD_REQUEST)

        meal_request.status = 'delivered'
        meal_request.save(update_fields=['status', 'updated_at'])
        return Response(self.get_serializer(meal_request).data)


class MealWastageViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for MealWastage."""

    queryset = MealWastage.objects.select_related('meal', 'recorded_by').all()
    serializer_class = MealWastageSerializer
    permission_classes = [permissions.IsAuthenticated, (IsChef | IsAdmin | IsHR)]

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)


class MealFeedbackResponseViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for MealFeedbackResponse."""

    queryset = MealFeedbackResponse.objects.select_related('feedback', 'student').all()
    serializer_class = MealFeedbackResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)
