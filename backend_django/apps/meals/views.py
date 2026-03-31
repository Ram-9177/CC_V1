"""Meals app views."""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from apps.meals.models import (
    Meal, MealItem, MealFeedback, MealAttendance, MealPreference, 
    MealSpecialRequest, MenuNotification, MealWastage, MealFeedbackResponse
)
from apps.meals.serializers import (
    MealSerializer, MealItemSerializer, MealFeedbackSerializer,
    MealAttendanceSerializer, MealPreferenceSerializer,
    MealSpecialRequestSerializer, MenuNotificationSerializer,
    MealWastageSerializer, MealFeedbackResponseSerializer
)
from core.permissions import IsStaff, IsAdmin, IsChef, IsHR, IsTopLevel
from core.college_mixin import CollegeScopeMixin
from django.db.models import Avg
from datetime import date
from core.services import compute_dining_forecast

class MealViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for Meal."""
    queryset = Meal.objects.all()
    serializer_class = MealSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'forecast']:
            return [permissions.IsAuthenticated(), (IsChef | IsAdmin | IsHR)()]
        return super().get_permissions()

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def forecast(self, request):
        """Get dining attendance forecast."""
        date_str = request.query_params.get('date')
        meal_type = request.query_params.get('meal_type')
        
        try:
            target_date = date.fromisoformat(date_str) if date_str else date.today()
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, 
                            status=status.HTTP_400_BAD_REQUEST)
        
        # Multi-tenant hard isolation (Phase 6)
        college_id = getattr(request.user, 'college_id', None)
        result = compute_dining_forecast(target_date, meal_type, college_id=college_id)
        return Response(result)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def mark_attendance(self, request, pk=None):
        """Mark student attendance for a meal."""
        meal = self.get_object()
        user = request.user
        
        attendance, created = MealAttendance.objects.get_or_create(
            meal=meal,
            student=user,
            defaults={'status': 'taken'}
        )
        
        if not created:
            attendance.status = 'taken'
            attendance.save()
            
        return Response({'status': 'attendance marked'})

class MealFeedbackViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for MealFeedback."""
    queryset = MealFeedback.objects.select_related('user', 'meal').all()
    serializer_class = MealFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

from django.db.models import Avg, Q

class EnhancedMealFeedbackViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Enhanced ViewSet for MealFeedback with HR analytics."""
    queryset = MealFeedback.objects.all()
    serializer_class = MealFeedbackSerializer
    permission_classes = [IsHR | IsAdmin]

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Get summary analytics for meal feedback."""
        # Multi-tenant hard isolation (Phase 6)
        college = getattr(request.user, 'college', None)
        cf = Q(college=college) if college else Q()
        qs = MealFeedback.objects.filter(cf)
        
        avg_rating = qs.aggregate(avg=Avg('rating'))['avg']
        return Response({
            'overall_average': avg_rating or 0,
            'total_responses': qs.count()
        })

class MenuNotificationViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for MenuNotification."""
    queryset = MenuNotification.objects.all()
    serializer_class = MenuNotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsChef()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

class MealSpecialRequestViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for MealSpecialRequest."""
    queryset = MealSpecialRequest.objects.select_related('student').all()
    serializer_class = MealSpecialRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base_qs = super().get_queryset()
        if user.role in ['admin', 'super_admin', 'chef', 'head_chef']:
            return base_qs
        return base_qs.filter(student=user)

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)
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
