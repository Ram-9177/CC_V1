"""Meals app serializers."""
from rest_framework import serializers
from apps.meals.models import Meal, MealItem, MealFeedback, MealAttendance, MealPreference, MealSpecialRequest, MenuNotification
from apps.auth.serializers import UserSerializer
from datetime import date

class MealItemSerializer(serializers.ModelSerializer):
    """Serializer for MealItem."""
    
    class Meta:
        model = MealItem
        fields = ['id', 'name', 'quantity']

class MealFeedbackSerializer(serializers.ModelSerializer):
    """Serializer for MealFeedback."""
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = MealFeedback
        fields = ['id', 'user', 'user_name', 'rating', 'comment', 'created_at']

class MealSerializer(serializers.ModelSerializer):
    """Serializer for Meal."""
    items = MealItemSerializer(many=True, read_only=True)
    feedback = MealFeedbackSerializer(many=True, read_only=True)
    average_rating = serializers.SerializerMethodField()
    date = serializers.DateField(source='meal_date', read_only=True)
    menu = serializers.CharField(source='description', read_only=True)
    available = serializers.SerializerMethodField()
    
    class Meta:
        model = Meal
        fields = [
            'id', 'meal_type', 'meal_date', 'description', 'cost',
            'items', 'feedback', 'average_rating', 'created_at',
            'date', 'menu', 'available', 'is_feedback_active', 'feedback_prompt'
        ]
    
    def get_average_rating(self, obj):
        """Calculate average rating for the meal (Only for HR/Staff)."""
        request = self.context.get('request')
        if not request:
            return None
            
        user = request.user
        is_hr = user.groups.filter(name='Student_HR').exists()
        
        # Original logic but check permission
        from core.permissions import user_is_staff, user_is_admin
        if not (user_is_staff(user) or user_is_admin(user) or is_hr):
            return None

        feedbacks = obj.feedback.all()
        if feedbacks:
            return sum(f.rating for f in feedbacks) / len(feedbacks)
        return None

    def to_representation(self, instance):
        """Filter feedback based on permissions."""
        data = super().to_representation(instance)
        request = self.context.get('request')
        if not request:
            return data
            
        user = request.user
        from core.permissions import user_is_staff, user_is_admin
        is_hr = user.groups.filter(name='Student_HR').exists()
        
        # Only HR/Staff see all feedback
        if not (user_is_staff(user) or user_is_admin(user) or is_hr):
            # Regular students only see their own feedback (if any)
            data['feedback'] = [f for f in data['feedback'] if f['user'] == user.id]
        
        return data

    def get_available(self, obj):
        return obj.meal_date >= date.today()


class MealAttendanceSerializer(serializers.ModelSerializer):
    student_details = UserSerializer(source='student', read_only=True)
    meal_details = MealSerializer(source='meal', read_only=True)

    class Meta:
        model = MealAttendance
        fields = ['id', 'meal', 'meal_details', 'student', 'student_details', 'status', 'marked_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['meal'] = data.get('meal_details')
        data['student'] = data.get('student_details')
        return data


class MealPreferenceSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = MealPreference
        fields = ['id', 'meal_type', 'user', 'user_details', 'preference', 'dietary_restrictions', 'created_at']


class MealSpecialRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.get_full_name', read_only=True)
    hall_ticket = serializers.CharField(source='student.registration_number', read_only=True)

    class Meta:
        model = MealSpecialRequest
        fields = [
            'id', 'student', 'student_name', 'hall_ticket', 'item_name', 
            'quantity', 'requested_for_date', 'status', 'notes', 'created_at'
        ]
        read_only_fields = ['student', 'status', 'created_at']

class MenuNotificationSerializer(serializers.ModelSerializer):
    """Serializer for MenuNotification posted by Chef."""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    
    class Meta:
        model = MenuNotification
        fields = [
            'id', 'created_by', 'created_by_name', 'menu_date', 'menu_text',
            'meal_type', 'status', 'published_at', 'created_at'
        ]
        read_only_fields = ['created_by', 'published_at', 'created_at']