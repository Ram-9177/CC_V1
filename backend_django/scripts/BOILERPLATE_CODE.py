"""
Boilerplate code for remaining apps.
Copy and customize each for your app.
"""

# =============================================================================
# COLLEGES APP
# =============================================================================

# colleges/models.py
from django.db import models
from core.models import TimestampedModel

class College(TimestampedModel):
    name = models.CharField(max_length=200, unique=True)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=15, blank=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name


# colleges/serializers.py
from rest_framework import serializers
from apps.colleges.models import College

class CollegeSerializer(serializers.ModelSerializer):
    class Meta:
        model = College
        fields = ['id', 'name', 'code', 'description', 'location', 'contact_email', 'contact_phone']


# colleges/views.py
from rest_framework import viewsets
from apps.colleges.models import College
from apps.colleges.serializers import CollegeSerializer

class CollegeViewSet(viewsets.ModelViewSet):
    queryset = College.objects.all()
    serializer_class = CollegeSerializer


# colleges/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.colleges import views

router = DefaultRouter()
router.register(r'', views.CollegeViewSet)

urlpatterns = [path('', include(router.urls))]


# colleges/admin.py
from django.contrib import admin
from apps.colleges.models import College

@admin.register(College)
class CollegeAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'location']
    search_fields = ['name', 'code']


# =============================================================================
# ATTENDANCE APP
# =============================================================================

# attendance/models.py
from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User
from django.utils import timezone
from datetime import date

class Attendance(TimestampedModel):
    STATUS_CHOICES = [
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('late', 'Late'),
        ('excused', 'Excused'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='attendance')
    attendance_date = models.DateField(default=date.today)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-attendance_date']
        unique_together = ['user', 'attendance_date']
        indexes = [models.Index(fields=['user', '-attendance_date'])]
    
    def __str__(self):
        return f"{self.user} - {self.attendance_date}"


# attendance/serializers.py
from rest_framework import serializers
from apps.attendance.models import Attendance

class AttendanceSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    
    class Meta:
        model = Attendance
        fields = ['id', 'user', 'user_name', 'attendance_date', 'status', 
                  'check_in_time', 'check_out_time', 'remarks', 'created_at']


# attendance/views.py
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from apps.attendance.models import Attendance
from apps.attendance.serializers import AttendanceSerializer
from django.db.models import Q

class AttendanceViewSet(viewsets.ModelViewSet):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'attendance_date', 'user']
    search_fields = ['user__username', 'user__first_name', 'user__last_name']
    
    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        """Get monthly attendance report."""
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        user_id = request.query_params.get('user_id')
        
        queryset = self.get_queryset()
        if year and month:
            queryset = queryset.filter(attendance_date__year=year, attendance_date__month=month)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


# attendance/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.attendance import views

router = DefaultRouter()
router.register(r'', views.AttendanceViewSet)

urlpatterns = [path('', include(router.urls))]


# =============================================================================
# GATE PASSES APP
# =============================================================================

# gate_passes/models.py
from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User

class GatePass(TimestampedModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('expired', 'Expired'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gate_passes')
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    reason = models.TextField()
    destination = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, 
                                   blank=True, related_name='approved_gate_passes')
    approval_date = models.DateTimeField(null=True, blank=True)
    qr_code = models.ImageField(upload_to='gate_passes/', null=True, blank=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.user} - {self.start_date.date()}"


# gate_passes/serializers.py
from rest_framework import serializers
from apps.gate_passes.models import GatePass

class GatePassSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    
    class Meta:
        model = GatePass
        fields = ['id', 'user', 'user_name', 'start_date', 'end_date', 'reason', 
                  'destination', 'status', 'approved_by', 'approved_by_name', 
                  'approval_date', 'qr_code', 'created_at']


# gate_passes/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from apps.gate_passes.models import GatePass
from apps.gate_passes.serializers import GatePassSerializer
from utils.qrcode import qr_code_to_file
from django.utils import timezone

class GatePassViewSet(viewsets.ModelViewSet):
    queryset = GatePass.objects.all()
    serializer_class = GatePassSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'user']
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a gate pass."""
        gate_pass = self.get_object()
        gate_pass.status = 'approved'
        gate_pass.approved_by = request.user
        gate_pass.approval_date = timezone.now()
        
        # Generate QR code
        qr_data = f"GATEPASS-{gate_pass.id}"
        qr_file, filename = qr_code_to_file(qr_data)
        gate_pass.qr_code.save(filename, qr_file)
        gate_pass.save()
        
        serializer = self.get_serializer(gate_pass)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a gate pass."""
        gate_pass = self.get_object()
        gate_pass.status = 'rejected'
        gate_pass.approved_by = request.user
        gate_pass.approval_date = timezone.now()
        gate_pass.save()
        
        serializer = self.get_serializer(gate_pass)
        return Response(serializer.data)


# gate_passes/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from apps.gate_passes import views

router = DefaultRouter()
router.register(r'', views.GatePassViewSet)

urlpatterns = [path('', include(router.urls))]


# =============================================================================
# GATE SCANS APP
# =============================================================================

# gate_scans/models.py
from django.db import models
from core.models import TimestampedModel
from apps.auth.models import User
from apps.gate_passes.models import GatePass

class GateScan(TimestampedModel):
    SCAN_TYPE_CHOICES = [
        ('entry', 'Entry'),
        ('exit', 'Exit'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gate_scans')
    gate_pass = models.ForeignKey(GatePass, on_delete=models.SET_NULL, null=True, blank=True)
    scan_type = models.CharField(max_length=10, choices=SCAN_TYPE_CHOICES)
    scan_time = models.DateTimeField(auto_now_add=True)
    qr_code = models.CharField(max_length=255)
    location = models.CharField(max_length=100, blank=True)
    
    class Meta:
        ordering = ['-scan_time']
        indexes = [models.Index(fields=['user', '-scan_time'])]
    
    def __str__(self):
        return f"{self.user} - {self.scan_type} - {self.scan_time}"


# And so on for remaining apps...
