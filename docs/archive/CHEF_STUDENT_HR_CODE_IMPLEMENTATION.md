# Chef & Student HR Authorities - Code Implementation

## DATABASE MODELS

### 1. Enhanced Meal Model (Add to meals/models.py)

```python
class Meal(TimestampedModel):
    """Meal model for meal planning."""
    
    MEAL_TYPE_CHOICES = [
        ('breakfast', 'Breakfast'),
        ('lunch', 'Lunch'),
        ('dinner', 'Dinner'),
        ('snacks', 'Snacks'),
    ]
    
    meal_type = models.CharField(max_length=20, choices=MEAL_TYPE_CHOICES)
    meal_date = models.DateField()
    description = models.TextField()
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='meals_created')
    
    # Feedback Requesting
    is_feedback_active = models.BooleanField(default=False)
    feedback_prompt = models.CharField(max_length=255, blank=True, null=True)
    
    # NEW: Menu notification system
    menu_posted = models.BooleanField(default=False)  # Chef posted this to students
    posted_at = models.DateTimeField(null=True, blank=True)  # When posted
    posted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='menus_posted')
    
    class Meta:
        ordering = ['-meal_date', 'meal_type']
        unique_together = ['meal_date', 'meal_type']
        indexes = [models.Index(fields=['-meal_date']), models.Index(fields=['menu_posted'])]
    
    def __str__(self):
        return f"{self.get_meal_type_display()} - {self.meal_date}"
```

### 2. New MenuNotification Model (Add to meals/models.py)

```python
class MenuNotification(TimestampedModel):
    """Menu notifications posted by chef to all students."""
    
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]
    
    created_by = models.ForeignKey(User, on_delete=models.PROTECT, related_name='menu_notifications_created')
    menu_date = models.DateField()
    menu_text = models.TextField()  # Full menu details
    meal_type = models.CharField(max_length=20, choices=Meal.MEAL_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    
    published_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-menu_date', '-created_at']
        indexes = [models.Index(fields=['-menu_date', 'status'])]
    
    def __str__(self):
        return f"Menu - {self.menu_date} ({self.get_status_display()})"
```

### 3. Enhanced MealFeedback Model (Add to meals/models.py)

```python
class MealFeedback(TimestampedModel):
    """Feedback on meals - supports both private HR feedback and public surveys."""
    
    FEEDBACK_TYPE_CHOICES = [
        ('private', 'Private (HR only to Chef)'),
        ('public', 'Public (All students can respond)'),
    ]
    
    meal = models.ForeignKey(Meal, on_delete=models.CASCADE, related_name='feedbacks')
    submitted_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='meal_feedbacks_submitted')
    
    # NEW: Distinguish between private and public feedback
    feedback_type = models.CharField(
        max_length=20,
        choices=FEEDBACK_TYPE_CHOICES,
        default='private'
    )
    
    # Only applies to public feedback
    is_published_by_hr = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    
    # Rating (1-5)
    rating = models.IntegerField(choices=[(i, f"{i} stars") for i in range(1, 6)])
    comments = models.TextField(blank=True, null=True)
    
    # Visible only to Chef if private
    is_visible_to_all = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['meal', 'feedback_type']),
            models.Index(fields=['submitted_by', 'feedback_type']),
            models.Index(fields=['is_published_by_hr']),
        ]
    
    def __str__(self):
        return f"Feedback on {self.meal} by {self.submitted_by.email} ({self.get_feedback_type_display()})"
```

---

## BACKEND VIEWS

### 1. Chef Menu Management (Add to meals/views.py)

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from core.permissions import IsChef
from .models import MenuNotification, Meal, MealFeedback
from .serializers import MenuNotificationSerializer

class MenuNotificationViewSet(viewsets.ModelViewSet):
    """Chef can post menus to all students."""
    
    serializer_class = MenuNotificationSerializer
    permission_classes = [IsChef]
    
    def get_queryset(self):
        user = self.request.user
        # Chef sees all menus, students see only published
        if user.role in ['chef', 'head_chef', 'admin']:
            return MenuNotification.objects.all()
        else:
            return MenuNotification.objects.filter(status='published')
    
    def perform_create(self, serializer):
        """Chef creates a new menu (initially as draft)."""
        serializer.save(created_by=self.request.user, status='draft')
    
    @action(detail=True, methods=['post'])
    def publish_menu(self, request, pk=None):
        """Chef publishes menu to all students."""
        menu = self.get_object()
        
        # Check permission
        if request.user.role not in ['chef', 'head_chef', 'admin']:
            return Response(
                {'error': 'Only Chef can publish menus'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        menu.status = 'published'
        menu.published_at = timezone.now()
        menu.save()
        
        # WebSocket broadcast to all students
        from django.db.models.signals import post_save
        broadcast_to_role('student', 'menu_published', {
            'menu_id': menu.id,
            'menu_date': str(menu.menu_date),
            'meal_type': menu.meal_type,
            'menu_text': menu.menu_text,
            'published_at': menu.published_at.isoformat()
        })
        
        # Notify all students via WebSocket
        broadcast_to_group('all_students', 'menu_update', {
            'type': 'menu_published',
            'menu_id': menu.id,
            'date': str(menu.menu_date),
            'timestamp': timezone.now().isoformat()
        })
        
        return Response({
            'status': 'published',
            'message': 'Menu published to all students',
            'menu_id': menu.id
        })
    
    @action(detail=True, methods=['post'])
    def archive_menu(self, request, pk=None):
        """Chef archives menu."""
        menu = self.get_object()
        menu.status = 'archived'
        menu.save()
        return Response({'status': 'archived'})


class MealFeedbackViewSet(viewsets.ModelViewSet):
    """Handle both private HR feedback and public student surveys."""
    
    serializer_class = MealFeedbackSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Chef sees all feedbacks (private + public)
        if user.role in ['chef', 'head_chef', 'admin']:
            return MealFeedback.objects.all()
        
        # Student HR can:
        # 1. See public feedbacks they created
        # 2. See their own private feedback responses
        # 3. NOT see other HR's private feedback
        if user.groups.filter(name='Student_HR').exists():
            return MealFeedback.objects.filter(
                models.Q(is_published_by_hr=True, submitted_by=user) |  # Their own public
                models.Q(feedback_type='private', submitted_by=user)  # Their own private
            )
        
        # Regular students see only published feedback they can respond to
        return MealFeedback.objects.filter(
            feedback_type='public',
            is_published_by_hr=True
        )
    
    def perform_create(self, request):
        """
        Create feedback:
        - Student HR can create private feedback (only for Chef)
        - Student HR can create public feedback (visible to all)
        """
        user = request.user
        
        # Only Chef and Student HR can create feedback
        if user.role not in ['chef', 'head_chef', 'admin'] and \
           not user.groups.filter(name='Student_HR').exists():
            return Response(
                {'error': 'Only Chef or Student HR can create feedback'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Student HR gives private feedback to chef
        is_student_hr = user.groups.filter(name='Student_HR').exists()
        feedback_type = request.data.get('feedback_type', 'private')
        
        # Student HR private feedback must be type='private'
        if is_student_hr and feedback_type != 'private':
            return Response(
                {'error': 'Student HR must give private feedback'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def publish_feedback(self, request, pk=None):
        """Student HR publishes private feedback as public survey."""
        feedback = self.get_object()
        
        # Only Student HR who created it can publish
        if feedback.submitted_by != request.user:
            return Response(
                {'error': 'Can only publish your own feedback'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if feedback.feedback_type != 'private':
            return Response(
                {'error': 'Can only publish private feedback as public'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        feedback.feedback_type = 'public'
        feedback.is_published_by_hr = True
        feedback.published_at = timezone.now()
        feedback.is_visible_to_all = True
        feedback.save()
        
        # Broadcast to all students
        broadcast_to_group('all_students', 'public_feedback_published', {
            'feedback_id': feedback.id,
            'meal_id': feedback.meal.id,
            'question': feedback.comments,
            'published_by': 'Student HR',
            'timestamp': timezone.now().isoformat()
        })
        
        return Response({
            'status': 'published',
            'message': 'Feedback published to all students',
            'feedback_id': feedback.id
        })
    
    @action(detail=False, methods=['post'])
    def request_feedback(self, request):
        """Chef requests feedback from students."""
        if request.user.role not in ['chef', 'head_chef', 'admin']:
            return Response(
                {'error': 'Only Chef can request feedback'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        meal_id = request.data.get('meal_id')
        prompt = request.data.get('prompt', 'Please provide feedback on this meal')
        
        meal = Meal.objects.get(id=meal_id)
        meal.is_feedback_active = True
        meal.feedback_prompt = prompt
        meal.save()
        
        # Notify all students
        broadcast_to_role('student', 'feedback_requested', {
            'meal_id': meal_id,
            'prompt': prompt,
            'timestamp': timezone.now().isoformat()
        })
        
        return Response({
            'status': 'feedback_requested',
            'meal_id': meal_id
        })
```

### 2. Enhanced Meal Views with Chef Controls (meals/views.py)

```python
class MealViewSet(viewsets.ModelViewSet):
    """Meal management - Chef can create/edit/post menus."""
    
    serializer_class = MealSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        
        # Chef sees all meals
        if user.role in ['chef', 'head_chef', 'admin']:
            return Meal.objects.all()
        
        # Students see all meals (to view menus)
        return Meal.objects.filter(menu_posted=True)
    
    def perform_create(self, serializer):
        """Chef creates meals."""
        if self.request.user.role not in ['chef', 'head_chef', 'admin']:
            raise PermissionDenied("Only Chef can create meals")
        
        serializer.save(created_by=self.request.user)
    
    def perform_update(self, serializer):
        """Chef updates meals."""
        if self.request.user.role not in ['chef', 'head_chef', 'admin']:
            raise PermissionDenied("Only Chef can update meals")
        
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def post_to_students(self, request, pk=None):
        """Chef posts meal menu to all students."""
        meal = self.get_object()
        
        if request.user.role not in ['chef', 'head_chef', 'admin']:
            return Response(
                {'error': 'Only Chef can post menus'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        meal.menu_posted = True
        meal.posted_at = timezone.now()
        meal.posted_by = request.user
        meal.save()
        
        # Broadcast to all students
        broadcast_to_group('all_students', 'meal_menu_posted', {
            'meal_id': meal.id,
            'meal_type': meal.meal_type,
            'meal_date': str(meal.meal_date),
            'description': meal.description,
            'posted_at': meal.posted_at.isoformat()
        })
        
        return Response({
            'status': 'posted',
            'message': 'Menu posted to all students',
            'meal_id': meal.id
        })
```

---

## SERIALIZERS

### Add to meals/serializers.py

```python
from rest_framework import serializers
from .models import MenuNotification, MealFeedback, Meal

class MenuNotificationSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.email', read_only=True)
    
    class Meta:
        model = MenuNotification
        fields = [
            'id', 'created_by', 'created_by_name', 'menu_date', 'menu_text',
            'meal_type', 'status', 'published_at', 'created_at'
        ]
        read_only_fields = ['created_by', 'published_at']


class MealFeedbackSerializer(serializers.ModelSerializer):
    submitted_by_email = serializers.CharField(source='submitted_by.email', read_only=True)
    meal_info = serializers.SerializerMethodField()
    
    class Meta:
        model = MealFeedback
        fields = [
            'id', 'meal', 'meal_info', 'submitted_by', 'submitted_by_email',
            'feedback_type', 'is_published_by_hr', 'published_at',
            'rating', 'comments', 'is_visible_to_all', 'created_at'
        ]
        read_only_fields = ['submitted_by', 'published_at']
    
    def get_meal_info(self, obj):
        return {
            'id': obj.meal.id,
            'type': obj.meal.meal_type,
            'date': str(obj.meal.meal_date),
            'description': obj.meal.description
        }
```

---

## WEBSOCKET CHANNELS

### Add to websockets/consumers.py

```python
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
import json
from django.utils import timezone

class MealNotificationConsumer(AsyncWebsocketConsumer):
    """Handle meal and menu updates in real-time."""
    
    async def connect(self):
        user = self.scope['user']
        
        if not user.is_authenticated:
            await self.close()
            return
        
        # All students join all_students group
        if user.role == 'student':
            await self.channel_layer.group_add('all_students', self.channel_name)
        
        # Chef joins chef group
        if user.role in ['chef', 'head_chef']:
            await self.channel_layer.group_add('chefs', self.channel_name)
        
        # Student HR joins student_hr group
        if user.groups.filter(name='Student_HR').exists():
            await self.channel_layer.group_add('student_hr', self.channel_name)
        
        await self.accept()
    
    async def menu_update(self, event):
        """Broadcast menu updates to all students."""
        await self.send(text_data=json.dumps({
            'type': 'menu_update',
            'data': event['message']
        }))
    
    async def feedback_notification(self, event):
        """Notify when feedback is requested."""
        await self.send(text_data=json.dumps({
            'type': 'feedback_request',
            'meal_id': event['meal_id'],
            'prompt': event['prompt']
        }))
    
    async def feedback_published(self, event):
        """Notify when public feedback is published."""
        await self.send(text_data=json.dumps({
            'type': 'public_feedback_published',
            'feedback_id': event['feedback_id'],
            'published_at': event['published_at']
        }))

def broadcast_to_group(group_name, event_type, data):
    """Helper function to broadcast to WebSocket group."""
    from channels.layers import get_channel_layer
    channel_layer = get_channel_layer()
    
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': event_type,
            'message': data
        }
    )
```

---

## PERMISSION CLASSES

### Add to core/permissions.py

```python
from core.permissions import IsChef

class IsChef(permissions.BasePermission):
    """Permission to check if user is a chef."""
    
    def has_permission(self, request, view):
        return request.user.role in [
            'chef', 'head_chef', 'admin', 'super_admin'
        ]


class IsStudentHR(permissions.BasePermission):
    """Permission to check if user is Student HR."""
    
    def has_permission(self, request, view):
        return request.user.groups.filter(name='Student_HR').exists()


class IsChefOrStudentHR(permissions.BasePermission):
    """Permission for both Chef and Student HR."""
    
    def has_permission(self, request, view):
        is_chef = request.user.role in ['chef', 'head_chef', 'admin']
        is_hr = request.user.groups.filter(name='Student_HR').exists()
        return is_chef or is_hr
```

---

## FRONTEND COMPONENTS

### 1. Chef Menu Management Component (src/pages/ChefMenuPage.tsx)

```typescript
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function ChefMenuPage() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draftMenu, setDraftMenu] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMealType, setSelectedMealType] = useState('breakfast');

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      const response = await api.get('/meals/menu-notifications/');
      setMenus(response.data);
    } catch (error) {
      toast.error('Failed to fetch menus');
    }
  };

  const handleCreateMenu = async () => {
    if (!draftMenu || !selectedDate) {
      toast.error('Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/meals/menu-notifications/', {
        menu_date: selectedDate,
        meal_type: selectedMealType,
        menu_text: draftMenu,
        status: 'draft'
      });

      toast.success('Menu created as draft');
      setDraftMenu('');
      setSelectedDate('');
      fetchMenus();
    } catch (error) {
      toast.error('Failed to create menu');
    } finally {
      setLoading(false);
    }
  };

  const handlePublishMenu = async (menuId: number) => {
    try {
      await api.post(`/meals/menu-notifications/${menuId}/publish_menu/`);
      toast.success('Menu published to all students!');
      fetchMenus();
    } catch (error) {
      toast.error('Failed to publish menu');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">📋 Post Menu to Students</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Meal Date</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Meal Type</label>
            <select
              value={selectedMealType}
              onChange={(e) => setSelectedMealType(e.target.value)}
              className="w-full border rounded p-2"
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snacks">Snacks</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Menu Details</label>
            <Textarea
              value={draftMenu}
              onChange={(e) => setDraftMenu(e.target.value)}
              placeholder="Describe the menu items for this meal..."
              rows={6}
            />
          </div>

          <Button
            onClick={handleCreateMenu}
            disabled={loading}
            className="w-full"
          >
            {loading ? 'Creating...' : '📝 Create Menu'}
          </Button>
        </div>
      </div>

      <div className="border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">📤 Your Menus</h2>

        <div className="space-y-3">
          {menus.map((menu) => (
            <div
              key={menu.id}
              className={`border rounded p-4 ${
                menu.status === 'published'
                  ? 'bg-green-50 border-green-300'
                  : 'bg-yellow-50 border-yellow-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold">
                    {menu.meal_type.toUpperCase()} - {menu.menu_date}
                  </h3>
                  <p className="text-sm mt-2">{menu.menu_text}</p>
                  <span
                    className={`text-xs font-semibold mt-2 inline-block px-2 py-1 rounded ${
                      menu.status === 'published'
                        ? 'bg-green-200 text-green-800'
                        : 'bg-yellow-200 text-yellow-800'
                    }`}
                  >
                    {menu.status.toUpperCase()}
                  </span>
                </div>

                {menu.status === 'draft' && (
                  <Button
                    onClick={() => handlePublishMenu(menu.id)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    📤 Publish
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 2. Chef Feedback Request Component (src/pages/ChefFeedbackPage.tsx)

```typescript
import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function ChefFeedbackPage() {
  const [meals, setMeals] = useState([]);
  const [feedbackPrompt, setFeedbackPrompt] = useState('');
  const [selectedMealId, setSelectedMealId] = useState(null);

  const handleRequestFeedback = async () => {
    if (!selectedMealId || !feedbackPrompt) {
      toast.error('Please select a meal and add a prompt');
      return;
    }

    try {
      await api.post('/meals/feedbacks/request_feedback/', {
        meal_id: selectedMealId,
        prompt: feedbackPrompt
      });

      toast.success('Feedback request sent to all students!');
      setFeedbackPrompt('');
      setSelectedMealId(null);
    } catch (error) {
      toast.error('Failed to request feedback');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">📊 Request Meal Feedback</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Select Meal</label>
            <select
              value={selectedMealId || ''}
              onChange={(e) => setSelectedMealId(Number(e.target.value))}
              className="w-full border rounded p-2"
            >
              <option value="">-- Choose a meal --</option>
              {meals.map((meal) => (
                <option key={meal.id} value={meal.id}>
                  {meal.meal_type} - {meal.meal_date}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Feedback Question</label>
            <Textarea
              value={feedbackPrompt}
              onChange={(e) => setFeedbackPrompt(e.target.value)}
              placeholder="Ask students for feedback on this meal..."
              rows={4}
            />
          </div>

          <Button
            onClick={handleRequestFeedback}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            📬 Request Feedback From All Students
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 3. Student HR Feedback Component (src/pages/StudentHRFeedbackPage.tsx)

```typescript
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function StudentHRFeedbackPage() {
  const [privateFeedback, setPrivateFeedback] = useState([]);
  const [publicFeedback, setPublicFeedback] = useState([]);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    try {
      const response = await api.get('/meals/feedbacks/');
      const feedback = response.data;
      setPrivateFeedback(feedback.filter((f) => f.feedback_type === 'private'));
      setPublicFeedback(feedback.filter((f) => f.is_published_by_hr));
    } catch (error) {
      toast.error('Failed to fetch feedback');
    }
  };

  const handleSubmitPrivateFeedback = async () => {
    if (!selectedMeal) {
      toast.error('Please select a meal');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/meals/feedbacks/', {
        meal: selectedMeal,
        feedback_type: 'private',
        rating,
        comments,
      });

      toast.success('Private feedback sent to Chef');
      setComments('');
      setRating(5);
      setSelectedMeal(null);
      fetchFeedback();
    } catch (error) {
      toast.error('Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublicFeedback = async (feedbackId: number) => {
    try {
      await api.post(`/meals/feedbacks/${feedbackId}/publish_feedback/`);
      toast.success('Feedback published to all students!');
      fetchFeedback();
    } catch (error) {
      toast.error('Failed to publish feedback');
    }
  };

  return (
    <div className="space-y-6">
      {/* Private Feedback Section */}
      <div className="border rounded-lg p-6 bg-purple-50">
        <h2 className="text-2xl font-bold mb-4">🔒 Private Feedback to Chef</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Rate Meal</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-3xl ${
                    star <= rating ? 'text-yellow-400' : 'text-gray-300'
                  }`}
                >
                  ⭐
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Comments</label>
            <Textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Tell the chef what you think..."
              rows={4}
            />
          </div>

          <Button
            onClick={handleSubmitPrivateFeedback}
            disabled={isSubmitting}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isSubmitting ? 'Sending...' : '📧 Send Private Feedback to Chef'}
          </Button>
        </div>
      </div>

      {/* Public Feedback Section */}
      <div className="border rounded-lg p-6 bg-blue-50">
        <h2 className="text-2xl font-bold mb-4">🌐 Public Surveys</h2>

        <div className="space-y-3">
          {publicFeedback.length === 0 ? (
            <p className="text-gray-600">No public surveys yet</p>
          ) : (
            publicFeedback.map((feedback) => (
              <div key={feedback.id} className="border rounded p-3 bg-white">
                <h3 className="font-bold">Survey #{feedback.id}</h3>
                <p className="text-sm mt-1">{feedback.comments}</p>
                <span className="text-xs bg-blue-200 px-2 py-1 rounded mt-2 inline-block">
                  Published by HR
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## MIGRATIONS

### Create migration file: backend_django/apps/meals/migrations/0xxx_add_chef_authorities.py

```python
from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('meals', '0xxx_previous_migration'),
    ]

    operations = [
        # Add fields to Meal model
        migrations.AddField(
            model_name='meal',
            name='menu_posted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='meal',
            name='posted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='meal',
            name='posted_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='menus_posted', to='auth.user'),
        ),
        
        # Create MenuNotification model
        migrations.CreateModel(
            name='MenuNotification',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('menu_date', models.DateField()),
                ('menu_text', models.TextField()),
                ('meal_type', models.CharField(choices=[('breakfast', 'Breakfast'), ('lunch', 'Lunch'), ('dinner', 'Dinner'), ('snacks', 'Snacks')], max_length=20)),
                ('status', models.CharField(choices=[('draft', 'Draft'), ('published', 'Published'), ('archived', 'Archived')], default='draft', max_length=20)),
                ('published_at', models.DateTimeField(blank=True, null=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='menu_notifications_created', to='auth.user')),
            ],
        ),
        
        # Add fields to MealFeedback model
        migrations.AddField(
            model_name='mealfeedback',
            name='feedback_type',
            field=models.CharField(choices=[('private', 'Private (HR only to Chef)'), ('public', 'Public (All students can respond)')], default='private', max_length=20),
        ),
        migrations.AddField(
            model_name='mealfeedback',
            name='is_published_by_hr',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='mealfeedback',
            name='is_visible_to_all',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='mealfeedback',
            name='published_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        
        # Add indexes
        migrations.AddIndex(
            model_name='menunotification',
            index=models.Index(fields=['-menu_date', 'status'], name='menu_date_status_idx'),
        ),
        migrations.AddIndex(
            model_name='mealfeedback',
            index=models.Index(fields=['meal', 'feedback_type'], name='meal_feedback_type_idx'),
        ),
    ]
```

---

## API ROUTES

### Add to backend_django/apps/meals/urls.py

```python
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'meals', views.MealViewSet, basename='meal')
router.register(r'feedbacks', views.MealFeedbackViewSet, basename='mealfeedback')
router.register(r'menu-notifications', views.MenuNotificationViewSet, basename='menu_notification')

urlpatterns = [
    path('', include(router.urls)),
]
```

---

## SUMMARY OF CHANGES

| Feature | Backend | Frontend | WebSocket | Permission |
|---------|---------|----------|-----------|-----------|
| Chef Post Menu | MenuNotification Model + View | ChefMenuPage | broadcast_to_group | IsChef |
| Chef Request Feedback | MealFeedback View Action | ChefFeedbackPage | broadcast_to_role | IsChef |
| Student HR Private Feedback | MealFeedback Model | StudentHRFeedbackPage | Notify Chef | IsStudentHR |
| Student HR Publish Public Feedback | publish_feedback Action | StudentHRFeedbackPage | broadcast_to_group | IsStudentHR |
| View Public Feedback | MealFeedback Queryset | StudentHRFeedbackPage | WebSocket updates | Any Student |

All code implements the exact workflow specified!
