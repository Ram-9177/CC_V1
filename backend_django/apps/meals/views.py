"""Meals app views."""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from datetime import date
from apps.meals.models import Meal, MealItem, MealFeedback, MealAttendance, MealPreference, MealSpecialRequest, MenuNotification
from apps.notifications.models import Notification
from apps.auth.models import User
from core.permissions import IsChef, IsWarden, user_is_admin, user_is_staff
from core.date_utils import parse_iso_date_or_none
from core.role_scopes import get_warden_building_ids
from websockets.broadcast import broadcast_to_role, broadcast_to_updates_user
from apps.notifications.utils import notify_user, notify_role
from apps.meals.serializers import (
    MealSerializer,
    MealFeedbackSerializer,
    MealAttendanceSerializer,
    MealPreferenceSerializer,
    MealSpecialRequestSerializer,
    MenuNotificationSerializer,
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
        """
        Filter queryset based on user role and optimize withPrefetching.
        Regular students only see their own feedback + public surveys.
        """
        from django.db.models import Prefetch, Q
        user = self.request.user
        
        # Optimize feedback prefetch: staff see all; students see their own + public HR surveys
        if user_is_admin(user) or user.role in ['chef', 'head_chef', 'warden', 'head_warden']:
            feedback_qs = MealFeedback.objects.select_related('user')
        elif user.groups.filter(name='Student_HR').exists():
            feedback_qs = MealFeedback.objects.filter(
                Q(user=user) | Q(feedback_type='public')
            ).select_related('user')
        else:
            feedback_qs = MealFeedback.objects.filter(
                Q(user=user) | Q(feedback_type='public', is_published_by_hr=True)
            ).select_related('user')

        queryset = Meal.objects.prefetch_related(
            'items',
            Prefetch('feedback', queryset=feedback_qs)
        )

        date_param = self.request.query_params.get('date')
        if date_param:
            target_date = parse_iso_date_or_none(date_param)
            if target_date:
                queryset = queryset.filter(meal_date=target_date)
        
        return queryset.all()

    def _get_cache_key(self, request):
        from core.cache_keys import meals_list_prefix
        user = request.user
        query_params = request.query_params.urlencode()
        return f"{meals_list_prefix()}:{user.role}:{user.id if user.role == 'student' else 'staff'}:{query_params}"

    def list(self, request, *args, **kwargs):
        from django.core.cache import cache
        cache_key = self._get_cache_key(request)
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        
        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 60) # 1 min cache
        return response

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

    def _invalidate_meal_caches(self):
        """Invalidate all meal-related list caches."""
        from django.core.cache import cache
        from core.cache_keys import meals_list_prefix, metrics_dashboard_global, metrics_chef
        # Versioned wildcard deletion (requires django-redis)
        cache.delete_pattern(f"{meals_list_prefix()}:*")
        # Global metrics use meal counts
        cache.delete(metrics_dashboard_global())
        # Chef stats also use meal info
        cache.delete(metrics_chef())

    def perform_create(self, serializer):
        meal = serializer.save(created_by=self.request.user)
        self._notify_students(meal, 'posted')
        self._invalidate_meal_caches()

    def perform_update(self, serializer):
        meal = serializer.save()
        self._notify_students(meal, 'updated')
        self._invalidate_meal_caches()


    
    @action(detail=True, methods=['post'])
    def add_feedback(self, request, pk=None):
        """Add feedback to a meal (Restricted to Student HR OR Active Session)."""
        from core.permissions import user_is_admin, user_is_staff
        
        meal = self.get_object()
        user = request.user
        is_hr = getattr(user, 'is_student_hr', False)
        
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
        
        # Notifications removed based on user request to reduce noise.
        # Management can view aggregated feedback in the metrics dashboard.
        
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
        is_hr = getattr(user, 'is_student_hr', False)
        
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
        Get expected number of students for dining (Backend-only Calculation Model).
        Delegates to core.services.compute_dining_forecast for optimised
        caching + single DB round-trip. Formula unchanged:
          Expected = Active Students - Approved Gatepass - Approved Leave - Absent
        """
        from datetime import timedelta
        from django.utils import timezone
        from core.services import compute_dining_forecast, invalidate_forecast_cache

        date_param = request.query_params.get('date')
        meal_type = request.query_params.get('meal_type')

        if date_param:
            target_date = parse_iso_date_or_none(date_param)
            if not target_date:
                return Response({'detail': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            target_date = timezone.localdate() + timedelta(days=1)

        # Delegate to service (handles cache hit/miss, DB queries, aggregation)
        result = compute_dining_forecast(target_date, meal_type)

        # Persist snapshot to DailyMealReport if meal_type supplied
        if meal_type:
            from apps.meals.models import DailyMealReport
            DailyMealReport.objects.update_or_create(
                date=target_date,
                meal_type=meal_type,
                defaults={
                    'original_population': result['total_students'],
                    'adjusted_population': result['forecasted_diners'],
                    'excluded_count': result['total_excluded_unique'],
                    'students_marked_absent': result['excluded_absent'],
                }
            )

        return Response(result)

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
    filterset_fields = ['feedback_type']
    ordering_fields = ['created_at', 'rating']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        is_hr = getattr(user, 'is_student_hr', False)
        
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
        is_hr = getattr(user, 'is_student_hr', False)
        
        # Restriction: Standard students only see their own requests
        if not (user_is_admin(user) or user_is_staff(user) or is_hr or user.role == 'chef'):
            return self.queryset.filter(student=user)
        
        return self.queryset

    def perform_create(self, serializer):
        request_obj = serializer.save(student=self.request.user)
        # Notify Warden/Head Warden for approval (Not Chef yet!)
        broadcast_to_role('warden', 'new_special_request_pending', {
            'student': self.request.user.get_full_name() or self.request.user.username,
            'item': request_obj.item_name,
            'id': request_obj.id
        })
        broadcast_to_role('head_warden', 'new_special_request_pending', {
            'student': self.request.user.get_full_name() or self.request.user.username,
            'item': request_obj.item_name,
            'id': request_obj.id
        })
        
        # Persistent Notification for Wardens
        notify_role('warden', 'New Special Meal Request', 
                    f"{self.request.user.get_full_name() or self.request.user.username} requested {request_obj.item_name}",
                    'info', '/meals')
        notify_role('head_warden', 'New Special Meal Request', 
                    f"{self.request.user.get_full_name() or self.request.user.username} requested {request_obj.item_name}",
                    'info', '/meals')

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Warden or Admin approves special request -> Now Chef is notified."""
        obj = self.get_object()
        if not (user_is_admin(request.user) or request.user.role in ['warden', 'head_warden']):
             return Response({'detail': 'Only Wardens or Admins can approve requests.'}, status=status.HTTP_403_FORBIDDEN)
        
        obj.status = 'approved'
        obj.save()
        
        # Notify Chef (Routing)
        broadcast_to_role('chef', 'special_request_approved', {
            'student': obj.student.get_full_name() or obj.student.username,
            'item': obj.item_name,
            'id': obj.id
        })
        notify_role('chef', 'Action Required: Approved Meal Request', 
                    f"Approved: {obj.item_name} for {obj.student.get_full_name() or obj.student.username}",
                    'info', '/meals')
        
        # Notify Student
        broadcast_to_updates_user(obj.student.id, 'special_request_status', {
            'id': obj.id,
            'status': 'approved',
            'item': obj.item_name
        })
        notify_user(obj.student, 'Special Meal Approved ✅', 
                    f"Your request for {obj.item_name} has been approved by the Warden.",
                    'info', '/meals')
        
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject special request."""
        obj = self.get_object()
        if not (user_is_admin(request.user) or request.user.role in ['warden', 'head_warden']):
             return Response({'detail': 'Only Wardens or Admins can reject requests.'}, status=status.HTTP_403_FORBIDDEN)
        
        obj.status = 'rejected'
        obj.save()
        
        # Notify Student
        broadcast_to_updates_user(obj.student.id, 'special_request_status', {
            'id': obj.id,
            'status': 'rejected',
            'item': obj.item_name
        })
        notify_user(obj.student, 'Special Meal Rejected ❌', 
                    f"Your request for {obj.item_name} was rejected.",
                    'alert', '/meals')
        
        return Response({'status': 'rejected'})

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        """Chef marks request as delivered."""
        obj = self.get_object()
        if request.user.role != 'chef' and not user_is_admin(request.user):
            return Response({'detail': 'Only Chef can mark as delivered.'}, status=status.HTTP_403_FORBIDDEN)
            
        obj.status = 'delivered'
        obj.save()
        
        broadcast_to_updates_user(obj.student.id, 'special_request_status', {
            'id': obj.id,
            'status': 'delivered'
        })
        notify_user(obj.student, 'Special Meal Delivered 🍽️', 
                    f"Your requested {obj.item_name} has been delivered. Enjoy!",
                    'info', '/meals')
        
        return Response({'status': 'delivered'})

class MenuNotificationViewSet(viewsets.ModelViewSet):
    """Chef can post menus to all students."""
    
    serializer_class = None  # Will set dynamically
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'meal_type']
    ordering_fields = ['-menu_date', '-created_at']
    
    def get_serializer_class(self):
        from apps.meals.serializers import MenuNotificationSerializer
        return MenuNotificationSerializer
    
    def get_queryset(self):
        user = self.request.user
        # Chef sees all menus, students see only published
        if user.role in ['chef', 'head_chef'] or user_is_admin(user):
            from apps.meals.models import MenuNotification
            return MenuNotification.objects.all()
        else:
            from apps.meals.models import MenuNotification
            return MenuNotification.objects.filter(status='published')
    
    def perform_create(self, serializer):
        """Chef creates a new menu (initially as draft)."""
        from rest_framework.exceptions import PermissionDenied
        # Only Chef can create
        if self.request.user.role not in ['chef', 'head_chef'] and not user_is_admin(self.request.user):
            raise PermissionDenied('Only Chef can create menus')
        serializer.save(created_by=self.request.user, status='draft')
    
    @action(detail=True, methods=['post'])
    def publish_menu(self, request, pk=None):
        """Chef publishes menu to all students."""
        from apps.meals.models import MenuNotification
        from django.utils import timezone
        
        menu = self.get_object()
        
        # Check permission
        if request.user.role not in ['chef', 'head_chef'] and not user_is_admin(request.user):
            return Response(
                {'error': 'Only Chef can publish menus'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        menu.status = 'published'
        menu.published_at = timezone.now()
        menu.save()
        
        # Create notification for all students
        from apps.notifications.models import Notification
        student_qs = User.objects.filter(role='student', is_active=True)
        notifications = [
            Notification(
                recipient=student,
                title=f"📋 Menu Posted: {menu.get_meal_type_display()} - {menu.menu_date}",
                message=f"New menu available:\n{menu.menu_text}",
                notification_type='info',
                action_url='/meals',
            )
            for student in student_qs
        ]
        if notifications:
            Notification.objects.bulk_create(notifications, batch_size=500)
        
        # WebSocket broadcast to all students
        broadcast_to_role('student', 'menu_published', {
            'menu_id': menu.id,
            'menu_date': str(menu.menu_date),
            'meal_type': menu.meal_type,
            'menu_text': menu.menu_text,
            'published_at': menu.published_at.isoformat()
        })
        
        return Response({
            'status': 'published',
            'message': 'Menu published to all students',
            'menu_id': menu.id
        })
    
    @action(detail=True, methods=['post'])
    def archive_menu(self, request, pk=None):
        """Chef archives menu."""
        from apps.meals.models import MenuNotification
        
        menu = self.get_object()
        
        if request.user.role not in ['chef', 'head_chef'] and not user_is_admin(request.user):
            return Response(
                {'error': 'Only Chef can archive menus'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        menu.status = 'archived'
        menu.save()
        return Response({'status': 'archived'})


# Enhanced MealFeedbackViewSet with privacy support
class EnhancedMealFeedbackViewSet(viewsets.ModelViewSet):
    """Enhanced MealFeedback ViewSet with private/public feedback support."""
    
    queryset = MealFeedback.objects.select_related('meal', 'user').all()
    serializer_class = MealFeedbackSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['feedback_type', 'is_published_by_hr']
    ordering_fields = ['-created_at', 'rating']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        is_hr = getattr(user, 'is_student_hr', False)
        
        # Chef sees all feedbacks (private + public)
        if user.role in ['chef', 'head_chef'] or user_is_admin(user):
            return self.queryset
        
        # Student HR can see their own private feedback and published public feedback
        if is_hr:
            from django.db.models import Q
            return self.queryset.filter(
                Q(is_published_by_hr=True, user=user) |  # Their own public
                Q(feedback_type='private', user=user)  # Their own private
            )
        
        # Regular students see only published feedback
        return self.queryset.filter(
            feedback_type='public',
            is_published_by_hr=True
        )

    def get_permissions(self):
        """
        Creation is handled via action on MealViewSet (add_feedback).
        Publishing is restricted to HR who created it.
        """
        if self.action in ['publish_feedback']:
            return [IsAuthenticated()]
        if self.action in ['destroy']:
            return [IsAuthenticated()]
        return super().get_permissions()
    
    @action(detail=True, methods=['post'])
    def publish_feedback(self, request, pk=None):
        """Student HR publishes private feedback as public survey."""
        feedback = self.get_object()
        user = request.user
        is_hr = getattr(user, 'is_student_hr', False)
        
        # Only Student HR who created it can publish
        if not is_hr or feedback.user != user:
            return Response(
                {'error': 'Can only publish your own feedback'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if feedback.feedback_type != 'private':
            return Response(
                {'error': 'Can only publish private feedback as public'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        from django.utils import timezone
        feedback.feedback_type = 'public'
        feedback.is_published_by_hr = True
        feedback.published_at = timezone.now()
        feedback.save()
        
        # Create notification for all students
        from apps.notifications.models import Notification
        student_qs = User.objects.filter(role='student', is_active=True)
        notifications = [
            Notification(
                recipient=student,
                title=f"📊 New Feedback Survey Available",
                message=f"A new meal feedback survey has been published. Please share your thoughts!",
                notification_type='info',
                action_url='/meals',
            )
            for student in student_qs
        ]
        if notifications:
            Notification.objects.bulk_create(notifications, batch_size=500)
        
        # Broadcast to all students
        broadcast_to_role('student', 'public_feedback_published', {
            'feedback_id': feedback.id,
            'meal_id': feedback.meal.id,
            'published_at': feedback.published_at.isoformat()
        })
        
        return Response({
            'status': 'published',
            'message': 'Feedback published to all students',
            'feedback_id': feedback.id
        })