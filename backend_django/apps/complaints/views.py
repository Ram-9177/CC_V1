from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Complaint
from .serializers import ComplaintSerializer
from core.permissions import IsStaff, IsStudent

class ComplaintViewSet(viewsets.ModelViewSet):
    """ViewSet for managing complaints."""
    serializer_class = ComplaintSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'severity', 'category', 'is_overdue']
    search_fields = ['title', 'description', 'student__username', 'student__registration_number']
    ordering_fields = ['created_at', 'status', 'severity']

    def get_queryset(self):
        user = self.request.user
        if user.role == 'student':
            return Complaint.objects.filter(student=user)
        # Staff/Admin see all
        return Complaint.objects.all()

    def perform_create(self, serializer):
        serializer.save(student=self.request.user)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update']:
             return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]
