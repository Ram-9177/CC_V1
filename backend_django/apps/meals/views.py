"""Meals app views."""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from datetime import date
from apps.meals.models import Meal, MealItem, MealFeedback, MealAttendance, MealPreference, MealSpecialRequest
from apps.notifications.models import Notification
from apps.auth.models import User
from core.permissions import IsChef, IsWarden, user_is_admin, user_is_staff
from core.date_utils import parse_iso_date_or_none
from core.role_scopes import get_warden_building_ids
from websockets.broadcast import broadcast_to_role
from apps.meals.serializers import (
    MealSerializer,
    MealFeedbackSerializer,
    MealAttendanceSerializer,
    MealPreferenceSerializer,
    MealSpecialRequestSerializer,
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
            target_date = parse_iso_date_or_none(date_param)
            if target_date:
                queryset = queryset.filter(meal_date=target_date)
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
        """Add feedback to a meal (Restricted to Student HR OR Active Session)."""
        from core.permissions import user_is_admin, user_is_staff
        
        meal = self.get_object()
        user = request.user
        is_hr = user.groups.filter(name='Student_HR').exists()
        
        # Permission: HR/Staff can always give feedback. 
        # Students can only give if is_feedback_active is True.
        can_feedback = (
            user_is_admin(user) or 
            user_is_staff(user) or 
            is_hr or 
            meal.is_feedback_active
        )
        
        if not can_feedback:
             return Response(
                 {'detail': 'Meal feedback is currently restricted. Only Student HRs can submit reports at this time.'},
                 status=status.HTTP_403_FORBIDDEN
             )

        data = request.data
        
        # Remove or update existing feedback from this user
        MealFeedback.objects.filter(meal=meal, user=request.user).delete()
        
        feedback = MealFeedback.objects.create(
            meal=meal,
            user=request.user,
            rating=data.get('rating'),
            comment=data.get('comment', '')
        )
        
        # Notify HRs and Chef if a student provides feedback
        if not (user_is_staff(user) or user_is_admin(user)):
             broadcast_to_role('chef', 'new_meal_feedback', {
                 'meal_id': meal.id,
                 'rating': feedback.rating,
             })
        
        serializer = MealFeedbackSerializer(feedback)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def toggle_feedback(self, request, pk=None):
        """Toggle active feedback prompt for a meal (Chef/Staff only)."""
        from core.permissions import IsChef, IsWarden
        
        # Explicit check for Chef/Staff
        if not (request.user.role in ['chef', 'head_chef'] or user_is_staff(request.user)):
            return Response({'detail': 'Only Chefs or Staff can request feedback.'}, status=status.HTTP_403_FORBIDDEN)
            
        meal = self.get_object()
        active = request.data.get('is_active', not meal.is_feedback_active)
        prompt = request.data.get('prompt', meal.feedback_prompt)
        
        meal.is_feedback_active = active
        meal.feedback_prompt = prompt
        meal.save()
        
        if active:
            # Notify students to give feedback
            title = f"Feedback Requested: {meal.get_meal_type_display()}"
            message = prompt or f"The chef wants to know how you liked today's {meal.get_meal_type_display()}!"
            
            student_qs = User.objects.filter(role='student', is_active=True)
            notifications = [
                Notification(
                    recipient=student,
                    title=title,
                    message=message,
                    notification_type='info',
                    action_url='/dashboard', # Send to dashboard to see the card
                )
                for student in student_qs
            ]
            if notifications:
                Notification.objects.bulk_create(notifications, batch_size=500)
                broadcast_to_role('student', 'feedback_requested', {
                    'meal_id': meal.id,
                    'prompt': message
                })
        
        return Response({
            'detail': f"Feedback {'activated' if active else 'deactivated'} for {meal.get_meal_type_display()}",
            'is_active': meal.is_feedback_active,
            'prompt': meal.feedback_prompt
        })

    @action(detail=False, methods=['get'], url_path='feedback-stats')
    def feedback_stats(self, request):
        """Get aggregated feedback stats for a date/meal."""
        user = request.user
        is_hr = user.groups.filter(name='Student_HR').exists()
        
        if not (user_is_admin(user) or user_is_staff(user) or is_hr):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        date_param = request.query_params.get('date')
        meal_type = request.query_params.get('meal_type')
        
        queryset = MealFeedback.objects.all()
        if date_param:
            target_date = parse_iso_date_or_none(date_param)
            if target_date:
                queryset = queryset.filter(meal__meal_date=target_date)
        
        if meal_type and meal_type != 'all':
            queryset = queryset.filter(meal__meal_type=meal_type)

        total = queryset.count()
        if total == 0:
            return Response({
                'total_feedback': 0,
                'average_rating': 0,
                'positive_count': 0,
                'negative_count': 0,
            })

        from django.db.models import Avg, Count
        avg_rating = queryset.aggregate(Avg('rating'))['rating__avg'] or 0
        positive = queryset.filter(rating__gte=4).count()
        negative = queryset.filter(rating__lte=2).count()

        return Response({
            'total_feedback': total,
            'average_rating': avg_rating,
            'positive_count': positive,
            'negative_count': negative,
        })
    
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
        if not (user_is_admin(user) or user_is_staff(user) or user.role == 'chef' or user.role == 'warden' or is_student_hr):
             # Default fallback: student checks own attendance? 
             # The original code threw 403, but students might want to see their own history.
             # For now, sticking to original logic but clarifying: non-staff/non-chef cannot view the list.
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)

        date_param = request.query_params.get('date')
        meal_type = request.query_params.get('meal_type')

        queryset = MealAttendance.objects.select_related('meal', 'student').all()

        if date_param:
            target_date = parse_iso_date_or_none(date_param)
            if not target_date:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(meal__meal_date=target_date)

        if meal_type and meal_type != 'all':
            queryset = queryset.filter(meal__meal_type=meal_type)

        # Warden: Filter to students in assigned building(s)
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            
            if warden_buildings.exists():
                queryset = queryset.filter(
                    student__room_allocations__room__building_id__in=warden_buildings,
                    student__room_allocations__end_date__isnull=True
                ).distinct()
            # If no buildings assigned, they see all (fail-safe)

        # FIX N+1: Use select_related and prefetch_related for the serializer
        queryset = queryset.select_related('meal', 'student').prefetch_related('meal__items')

        serializer = MealAttendanceSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def mark(self, request):
        """Mark meal attendance for current user or specified student (if authorized)."""
        meal_id = request.data.get('meal_id')
        status_value = request.data.get('status', 'taken')
        student_id = request.data.get('student_id')

        if not meal_id:
            return Response({'detail': 'meal_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            meal = Meal.objects.get(id=meal_id)
        except Meal.DoesNotExist:
            return Response({'detail': 'Meal not found.'}, status=status.HTTP_404_NOT_FOUND)

        target_user = request.user
        
        # Check if marking for another student
        if student_id:
            from core.permissions import user_is_admin, user_is_staff
            is_hr = request.user.groups.filter(name='Student_HR').exists()
            is_authorized = (
                user_is_admin(request.user) or 
                user_is_staff(request.user) or 
                request.user.role == 'chef' or 
                is_hr
            )
            
            if not is_authorized:
                 return Response({'detail': 'Not authorized to mark attendance for others.'}, status=status.HTTP_403_FORBIDDEN)
            
            try:
                target_user = User.objects.get(id=student_id)
            except User.DoesNotExist:
                return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        attendance, _ = MealAttendance.objects.update_or_create(
            meal=meal,
            student=target_user,
            defaults={'status': status_value}
        )

        # Broadcast updates
        data = {'meal_id': meal.id, 'student_id': target_user.id, 'status': status_value}
        broadcast_to_role('chef', 'meal_attendance_updated', data)
        broadcast_to_role('warden', 'meal_attendance_updated', data)
        broadcast_to_role('head_warden', 'meal_attendance_updated', data)
        # Also notify the student if someone else marked it? Maybe not critical for now.

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
        meal_type = request.query_params.get('meal_type')
        
        # Parse date or default to today
        if date_param:
            target_date = parse_iso_date_or_none(date_param)
            if not target_date:
                return Response({'detail': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            target_date = timezone.localdate()  # Aware date based on server timezone

        # 1. Total Active Students
        total_students = User.objects.filter(role='student', is_active=True).count()

        # 2. Meal Windows (Local Time)
        # Using standard hostel timings
        meal_windows = {
            'breakfast': (time(7, 30), time(10, 0)),
            'lunch': (time(12, 30), time(14, 30)),
            'snacks': (time(16, 30), time(17, 30)),
            'dinner': (time(19, 30), time(21, 30)),
        }

        current_tz = timezone.get_current_timezone()

        # Determine time range to check for overlap
        if meal_type and meal_type in meal_windows:
            start_time, end_time = meal_windows[meal_type]
            # Create naive datetime and make it aware in current timezone
            overlap_start = timezone.make_aware(datetime.combine(target_date, start_time), current_tz)
            overlap_end = timezone.make_aware(datetime.combine(target_date, end_time), current_tz)
        else:
            # Default: Entire day overlap
            overlap_start = timezone.make_aware(datetime.combine(target_date, time.min), current_tz)
            overlap_end = timezone.make_aware(datetime.combine(target_date, time.max), current_tz)

        # 3. Students "Out" on Gate Pass
        # Logic: Status is 'approved'/'used'. 
        # Pass start (exit) must be before window ends.
        # Pass end (entry) must be after window starts (or open-ended).
        students_on_leave = GatePass.objects.filter(
            Q(status='approved') | Q(status='used'),
            exit_date__lte=overlap_end
        ).filter(
            Q(entry_date__gte=overlap_start) | Q(entry_date__isnull=True)
        ).values('student').distinct().count()

        # 4. Students explicitly marked as SKIPPED/ABSENT for this meal
        # Only applicable if we have a specific meal context
        students_marked_absent = 0
        if meal_type and meal_type in meal_windows:
            try:
                # Find the meal object for this date/type to query attendance
                meal_obj = Meal.objects.filter(meal_date=target_date, meal_type=meal_type).first()
                if meal_obj:
                    students_marked_absent = MealAttendance.objects.filter(
                        meal=meal_obj, 
                        status='skipped'
                    ).count()
            except Exception:
                pass

        expected = total_students - students_on_leave - students_marked_absent

        return Response({
            'date': target_date.isoformat(),
            'meal_type': meal_type if meal_type in meal_windows else 'day_summary',
            'total_students': total_students,
            'students_on_leave': students_on_leave,
            'students_marked_absent': students_marked_absent,
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


class MealFeedbackViewSet(viewsets.ModelViewSet):
    """ViewSet for Meal Feedback management."""
    queryset = MealFeedback.objects.select_related('meal', 'user').all()
    serializer_class = MealFeedbackSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['resolved']
    ordering_fields = ['created_at', 'rating']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        is_hr = user.groups.filter(name='Student_HR').exists()
        
        # Restriction: Standard students only see their own feedback
        if not (user_is_admin(user) or user_is_staff(user) or is_hr):
            return self.queryset.filter(user=user)
            
        queryset = self.queryset
        date_param = self.request.query_params.get('date')
        if date_param:
            target_date = parse_iso_date_or_none(date_param)
            if target_date:
                queryset = queryset.filter(meal__meal_date=target_date)
        
        return queryset

    def get_permissions(self):
        """
        Creation is handled via action on MealViewSet (add_feedback).
        List/Update is restricted here.
        """
        if self.action in ['update', 'partial_update', 'destroy']:
            # Only staff/HR can update status (resolved)
            return [IsAuthenticated(), IsWarden()] # IsWarden includes Admin/Staff in many contexts
        return super().get_permissions()

class MealSpecialRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for Meal Special Requests."""
    queryset = MealSpecialRequest.objects.select_related('student').all()
    serializer_class = MealSpecialRequestSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status']
    ordering_fields = ['requested_for_date', 'created_at']

    def get_queryset(self):
        user = self.request.user
        is_hr = user.groups.filter(name='Student_HR').exists()
        
        # Restriction: Standard students only see their own requests
        if not (user_is_admin(user) or user_is_staff(user) or is_hr or user.role == 'chef'):
            return self.queryset.filter(student=user)
        
        return self.queryset

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)
        # Notify Chef
        broadcast_to_role('chef', 'new_special_request', {
            'student': self.request.user.name,
            'item': serializer.validated_data.get('item_name')
        })
