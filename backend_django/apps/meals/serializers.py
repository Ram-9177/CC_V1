"""Meals app serializers."""
from rest_framework import serializers
from apps.meals.models import Meal, MealItem, MealFeedback, MealAttendance, MealPreference
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
            'date', 'menu', 'available'
        ]
    
    def get_average_rating(self, obj):
        """Calculate average rating for the meal."""
        feedbacks = obj.feedback.all()
        if feedbacks:
            return sum(f.rating for f in feedbacks) / len(feedbacks)
        return None

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
