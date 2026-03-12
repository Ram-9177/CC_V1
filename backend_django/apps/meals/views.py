"""Meals app views."""
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from apps.meals.models import Meal, MealItem, MealFeedback, MealAttendance, MealPreference, MealSpecialRequest, MenuNotification
from apps.meals.serializers import (
    MealSerializer, MealItemSerializer, MealFeedbackSerializer,
    MealAttendanceSerializer, MealPreferenceSerializer,
    MealSpecialRequestSerializer, MenuNotificationSerializer
)
from core.permissions import IsStaff, IsAdmin, IsChef, IsHR, IsTopLevel
from django.db.models import Avg

class MealViewSet(viewsets.ModelViewSet):
    """ViewSet for Meal."""
    queryset = Meal.objects.all()
    serializer_class = MealSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsChef()]
        return super().get_permissions()

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

class MealFeedbackViewSet(viewsets.ModelViewSet):
    """ViewSet for MealFeedback."""
    queryset = MealFeedback.objects.all()
    serializer_class = MealFeedbackSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class EnhancedMealFeedbackViewSet(viewsets.ModelViewSet):
    """Enhanced ViewSet for MealFeedback with HR analytics."""
    queryset = MealFeedback.objects.all()
    serializer_class = MealFeedbackSerializer
    permission_classes = [IsHR | IsAdmin]

    @action(detail=False, methods=['get'])
    def analytics(self, request):
        """Get summary analytics for meal feedback."""
        # Simple placeholder analytics
        avg_rating = MealFeedback.objects.all().aggregate(avg=Avg('rating'))['avg']
        return Response({
            'overall_average': avg_rating or 0,
            'total_responses': MealFeedback.objects.count()
        })

class MenuNotificationViewSet(viewsets.ModelViewSet):
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

class MealSpecialRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for MealSpecialRequest."""
    queryset = MealSpecialRequest.objects.all()
    serializer_class = MealSpecialRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role in ['admin', 'super_admin', 'chef', 'head_chef']:
            return MealSpecialRequest.objects.all()
        return MealSpecialRequest.objects.filter(student=user)

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)
