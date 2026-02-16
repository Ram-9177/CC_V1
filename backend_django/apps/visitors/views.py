from rest_framework import viewsets, permissions, filters, status as http_status
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db import transaction
from datetime import date
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import VisitorLog, VisitorPreRegistration
from .serializers import VisitorLogSerializer, VisitorPreRegistrationSerializer
from core.permissions import IsGateSecurity, IsAdmin, IsWarden, IsStudent
from core.role_scopes import get_warden_building_ids, user_is_top_level_management

class VisitorLogViewSet(viewsets.ModelViewSet):
    """ViewSet for managing visitor logs."""
    serializer_class = VisitorLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'relationship']
    search_fields = ['visitor_name', 'student__username', 'student__registration_number', 'phone_number']
    ordering_fields = ['check_in', 'check_out']

    def get_queryset(self):
        user = self.request.user
        qs = VisitorLog.objects.all()
        
        # Admin, Super Admin, Head Warden, Gate Security see all
        if user_is_top_level_management(user) or user.role in ['gate_security', 'security_head']:
            return qs
        
        # Warden: See visitors for students in assigned building(s)
        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            
            if not warden_buildings.exists():
                return qs  # Fail-safe: unassigned wardens see all
            
            return qs.filter(
                student__room_allocations__room__building_id__in=warden_buildings,
                student__room_allocations__end_date__isnull=True
            ).distinct()
        
        # Students see their own visitors
        if user.role == 'student':
            return qs.filter(student=user)
        
        return qs.none()

    def get_permissions(self):
        # Gate Security + Wardens + Admins can manage
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsGateSecurity() | IsWarden() | IsAdmin()]
        return [IsAuthenticated()]

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

    @action(detail=False, methods=['post'])
    def checkin_from_prereg(self, request):
        """Check in a visitor from a pre-registration. Used by gate security."""
        prereg_id = request.data.get('pre_registration_id')
        if not prereg_id:
            return Response({'detail': 'pre_registration_id is required.'}, status=http_status.HTTP_400_BAD_REQUEST)

        try:
            prereg = VisitorPreRegistration.objects.get(id=prereg_id)
        except VisitorPreRegistration.DoesNotExist:
            return Response({'detail': 'Pre-registration not found.'}, status=http_status.HTTP_404_NOT_FOUND)

        if prereg.status not in ('approved', 'pending'):
            return Response({'detail': f'Cannot check in from a {prereg.status} pre-registration.'}, status=http_status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            visitor = VisitorLog.objects.create(
                student=prereg.student,
                visitor_name=prereg.visitor_name,
                relationship=prereg.relationship,
                phone_number=prereg.phone_number,
                purpose=prereg.purpose,
                id_proof_number=prereg.id_proof_number or request.data.get('id_proof_number', ''),
                photo_url=request.data.get('photo_url', ''),
                pre_registration=prereg,
            )
            prereg.status = 'checked_in'
            prereg.save(update_fields=['status'])

        return Response(VisitorLogSerializer(visitor).data, status=http_status.HTTP_201_CREATED)


class VisitorPreRegistrationViewSet(viewsets.ModelViewSet):
    """ViewSet for visitor pre-registration.
    
    Students can pre-register visitors. Wardens/Admins can approve/reject.
    Gate security can view approved pre-registrations for fast check-in.
    """
    serializer_class = VisitorPreRegistrationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'expected_date']
    search_fields = ['visitor_name', 'phone_number', 'student__username']
    ordering_fields = ['expected_date', 'created_at']

    def get_queryset(self):
        user = self.request.user
        qs = VisitorPreRegistration.objects.select_related('student', 'approved_by')

        if user_is_top_level_management(user):
            return qs

        if user.role in ['gate_security', 'security_head']:
            # Security sees approved pre-registrations for today and upcoming
            return qs.filter(status__in=['approved', 'pending'])

        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            if warden_buildings.exists():
                return qs.filter(
                    student__room_allocations__room__building_id__in=warden_buildings,
                    student__room_allocations__end_date__isnull=True
                ).distinct()
            return qs

        if user.role == 'student':
            return qs.filter(student=user)

        return qs.none()

    def perform_create(self, serializer):
        """Students create pre-registrations for themselves."""
        serializer.save(student=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsWarden | IsAdmin])
    def approve(self, request, pk=None):
        """Approve a pre-registration."""
        prereg = self.get_object()
        if prereg.status != 'pending':
            return Response({'detail': f'Cannot approve a {prereg.status} pre-registration.'}, status=http_status.HTTP_400_BAD_REQUEST)

        prereg.status = 'approved'
        prereg.approved_by = request.user
        prereg.save(update_fields=['status', 'approved_by'])
        return Response(self.get_serializer(prereg).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsWarden | IsAdmin])
    def reject(self, request, pk=None):
        """Reject a pre-registration."""
        prereg = self.get_object()
        if prereg.status != 'pending':
            return Response({'detail': f'Cannot reject a {prereg.status} pre-registration.'}, status=http_status.HTTP_400_BAD_REQUEST)

        prereg.status = 'rejected'
        prereg.approved_by = request.user
        prereg.rejection_reason = request.data.get('reason', '')
        prereg.save(update_fields=['status', 'approved_by', 'rejection_reason'])
        return Response(self.get_serializer(prereg).data)

    @action(detail=False, methods=['get'])
    def today(self, request):
        """Return pre-registrations expected today."""
        qs = self.get_queryset().filter(expected_date=date.today(), status__in=['approved', 'pending'])
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
