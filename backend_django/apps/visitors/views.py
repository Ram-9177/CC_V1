from rest_framework import viewsets, permissions, filters
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import VisitorLog
from .serializers import VisitorLogSerializer
from core.permissions import IsGateSecurity, IsAdmin

class VisitorLogViewSet(viewsets.ModelViewSet):
    """ViewSet for managing visitor logs."""
    serializer_class = VisitorLogSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'relationship']
    search_fields = ['visitor_name', 'student__username', 'student__registration_number', 'phone_number']
    ordering_fields = ['check_in', 'check_out']

    def get_queryset(self):
        return VisitorLog.objects.all()

    def get_permissions(self):
        # Only staff can manage visitors
        return [IsGateSecurity()]

    @action(detail=True, methods=['post'])
    def checkout(self, request, pk=None):
        """Mark visitor as checked out."""
        visitor = self.get_object()
        if visitor.check_out:
             return Response({'error': 'Already checked out'}, status=400)
        
        visitor.check_out = timezone.now()
        visitor.is_active = False
        visitor.save()
        return Response(self.get_serializer(visitor).data)
