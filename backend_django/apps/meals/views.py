"""Meals app views."""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from datetime import date
from apps.meals.models import Meal, MealItem, MealFeedback, MealAttendance, MealPreference
from apps.notifications.models import Notification
from apps.auth.models import User
from core.permissions import IsChef, IsWarden, user_is_admin, user_is_staff
from websockets.broadcast import broadcast_to_role
from apps.meals.serializers import (
    MealSerializer,
    MealFeedbackSerializer,
    MealAttendanceSerializer,
    MealPreferenceSerializer,
)

class MealViewSet(viewsets.ModelViewSet):
    """ViewSet for Meal management."""
    queryset = Meal.objects.prefetch_related('items', 'feedback').all()
    serializer_class = MealSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['meal_type', 'meal_date']
    search_fields = ['description']
    ordering_fields = ['-meal_date', 'meal_type']

    def get_permissions(self):
        """
        Restrict meal CRUD to chef/admin roles while keeping read access for all
        authenticated users.
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), (IsChef | IsWarden)()]
        return [permission() for permission in self.permission_classes]

    def get_queryset(self):
        queryset = super().get_queryset()
        date_param = self.request.query_params.get('date')
        if date_param:
            try:
                queryset = queryset.filter(meal_date=date.fromisoformat(date_param))
            except ValueError:
                pass
        return queryset

    def _notify_students(self, meal, action_label):
        title = f"Mess {meal.get_meal_type_display()} menu {action_label}"
        message = (
            f"Menu for {meal.get_meal_type_display()} on {meal.meal_date} has been {action_label}.\n"
            f"{meal.description}"
        )

        # This project models roles on `User.role`, not Django auth Groups.
        student_qs = User.objects.filter(role='student', is_active=True)
        notifications = [
            Notification(
                recipient=student,
                title=title,
                message=message,
                notification_type='info',
                action_url='/meals',
            )
            for student in student_qs
        ]
        if notifications:
            Notification.objects.bulk_create(notifications, batch_size=500)
            # bulk_create doesn't trigger per-row post_save signals, so we nudge clients
            # (via updates socket) to refresh their notifications lists.
            broadcast_to_role('student', 'notifications_updated', {'source': 'meals', 'meal_id': meal.id})
            # Also notify chef of updates
            broadcast_to_role('chef', 'notifications_updated', {'source': 'meals', 'meal_id': meal.id})

    def perform_create(self, serializer):
        meal = serializer.save(created_by=self.request.user)
        self._notify_students(meal, 'posted')

    def perform_update(self, serializer):
        meal = serializer.save()
        self._notify_students(meal, 'updated')
    
    @action(detail=True, methods=['post'])
    def add_feedback(self, request, pk=None):
        """Add feedback to a meal."""
        meal = self.get_object()
        data = request.data
        
        # Remove or update existing feedback from this user
        MealFeedback.objects.filter(meal=meal, user=request.user).delete()
        
        feedback = MealFeedback.objects.create(
            meal=meal,
            user=request.user,
            rating=data.get('rating'),
            comment=data.get('comment', '')
        )
        
        serializer = MealFeedbackSerializer(feedback)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
    @action(detail=False, methods=['get'])
    def by_date(self, request):
        """Get meals by date range."""
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        queryset = self.get_queryset()
        if start_date:
            queryset = queryset.filter(meal_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(meal_date__lte=end_date)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def attendance(self, request):
        """Return meal attendance records (Chef/Staff view aggregated, students view own)."""
        user = request.user

        is_student_hr = user.groups.filter(name='Student_HR').exists()
        
        # CHEF PRIVILEGE: Allow Chef to view all attendance data
        if not (user_is_admin(user) or user_is_staff(user) or user.role == 'chef' or is_student_hr):
             # Default fallback: student checks own attendance? 
             # The original code threw 403, but students might want to see their own history.
             # For now, sticking to original logic but clarifying: non-staff/non-chef cannot view the list.
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        date_param = request.query_params.get('date')
        meal_type = request.query_params.get('meal_type')

        queryset = MealAttendance.objects.select_related('meal', 'student').all()

        if date_param:
            try:
                target_date = date.fromisoformat(date_param)
                queryset = queryset.filter(meal__meal_date=target_date)
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if meal_type and meal_type != 'all':
            queryset = queryset.filter(meal__meal_type=meal_type)

        # FIX N+1: Use select_related and prefetch_related for the serializer
        queryset = queryset.select_related('meal', 'student').prefetch_related('meal__items')

        serializer = MealAttendanceSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def mark(self, request):
        """Mark meal attendance for current user."""
        meal_id = request.data.get('meal_id')
        status_value = request.data.get('status', 'taken')

        if not meal_id:
            return Response({'detail': 'meal_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            meal = Meal.objects.get(id=meal_id)
        except Meal.DoesNotExist:
            return Response({'detail': 'Meal not found.'}, status=status.HTTP_404_NOT_FOUND)

        attendance, _ = MealAttendance.objects.update_or_create(
            meal=meal,
            student=request.user,
            defaults={'status': status_value}
        )

        serializer = MealAttendanceSerializer(attendance)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def forecast(self, request):
        """
        Get expected number of students for dining based on Gate Passes and Active Students.
        Query Params: date (YYYY-MM-DD), meal_type (optional)
        """
        from datetime import datetime, time
        from django.utils import timezone
        from django.db.models import Q
        from apps.gate_passes.models import GatePass

        date_param = request.query_params.get('date')
        target_date = date.today()

        if date_param:
            try:
                target_date = date.fromisoformat(date_param)
            except ValueError:
                return Response({'detail': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Total Active Students
        total_students = User.objects.filter(role='student', is_active=True).count()

        # 2. Students "Out" on Gate Pass
        # Logic: Status is 'approved'/'used'. Date overlaps [exit, entry].
        start_of_day = datetime.combine(target_date, time.min).replace(tzinfo=timezone.utc)
        end_of_day = datetime.combine(target_date, time.max).replace(tzinfo=timezone.utc)

        # Count distinct students with overlapping passes
        students_on_leave = GatePass.objects.filter(
            Q(status='approved') | Q(status='used'),
            exit_date__lte=end_of_day
        ).filter(
            Q(entry_date__gte=start_of_day) | Q(entry_date__isnull=True)
        ).values('student').distinct().count()

        expected = total_students - students_on_leave

        return Response({
            'date': target_date.isoformat(),
            'total_students': total_students,
            'students_on_leave': students_on_leave,
            'expected_diners': expected if expected > 0 else 0
        })

    @action(detail=False, methods=['get', 'post'], url_path='preferences')
    def preferences(self, request):
        """Get or update meal preferences for current user."""
        if request.method == 'GET':
            preferences = MealPreference.objects.filter(user=request.user)
            serializer = MealPreferenceSerializer(preferences, many=True)
            return Response(serializer.data)

        meal_type = request.data.get('meal_type')
        # Only update fields explicitly provided; avoid wiping values.
        preference = request.data.get('preference', None)
        dietary_restrictions = request.data.get('dietary_restrictions', None)

        # Support "global" dietary restrictions update (frontend sends only dietary_restrictions).
        if not meal_type:
            if dietary_restrictions is None:
                return Response({'detail': 'meal_type is required.'}, status=status.HTTP_400_BAD_REQUEST)

            updated = []
            for mt, _ in Meal.MEAL_TYPE_CHOICES:
                pref, _ = MealPreference.objects.get_or_create(user=request.user, meal_type=mt)
                pref.dietary_restrictions = dietary_restrictions
                pref.save(update_fields=['dietary_restrictions'])
                updated.append(pref)

            serializer = MealPreferenceSerializer(updated, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)

        pref, _ = MealPreference.objects.get_or_create(user=request.user, meal_type=meal_type)
        update_fields = []
        if preference is not None:
            pref.preference = preference
            update_fields.append('preference')
        if dietary_restrictions is not None:
            pref.dietary_restrictions = dietary_restrictions
            update_fields.append('dietary_restrictions')

        if update_fields:
            pref.save(update_fields=update_fields)

        serializer = MealPreferenceSerializer(pref)
        return Response(serializer.data, status=status.HTTP_200_OK)
