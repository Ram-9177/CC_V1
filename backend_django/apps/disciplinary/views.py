from decimal import Decimal

from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from .models import DisciplinaryAction, FineLedgerEntry
from .serializers import DisciplinaryActionSerializer, FineLedgerEntrySerializer
from core.permissions import IsWarden, IsAdmin, IsPD, IsPrincipal, IsSecurityHead, IsHR
from core.college_mixin import CollegeScopeMixin
from core.role_scopes import get_warden_building_ids, user_is_top_level_management

class DisciplinaryActionViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """ViewSet for managing disciplinary actions."""
    queryset = DisciplinaryAction.objects.all()
    serializer_class = DisciplinaryActionSerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['action_type', 'severity', 'is_paid']
    search_fields = ['student__username', 'student__registration_number', 'title']
    ordering_fields = ['created_at', 'fine_amount']

    def get_queryset(self):
        user = self.request.user
        # Apply college scoping via mixin first
        base_qs = super().get_queryset()
        qs = base_qs.select_related('student', 'action_taken_by').prefetch_related('ledger_entries__created_by')

        if user_is_top_level_management(user):
            return qs

        # Roles with broad disciplinary access see all within college scope
        if user.role in ('principal', 'director', 'pd', 'security_head', 'hr'):
            return qs

        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            return qs.filter(student__room_allocations__room__building_id__in=warden_buildings, student__room_allocations__end_date__isnull=True).distinct()

        # PHASE 1: Students see ONLY their own fines
        if user.role == 'student':
            return qs.filter(student=user)

        return qs.none()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [(IsWarden | IsAdmin | IsPD | IsPrincipal | IsSecurityHead | IsHR)()]
        return [permissions.IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        from django.core.cache import cache
        import hashlib
        user = request.user
        query_params = request.query_params.urlencode()
        params_hash = hashlib.md5(query_params.encode()).hexdigest()[:12]
        cache_key = f"hc:disciplinary:list:{user.role}:{user.id}:{params_hash}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
            
        response = super().list(request, *args, **kwargs)
        if response.status_code == 200:
            cache.set(cache_key, response.data, 60) # 1 min cache
        return response


    def perform_create(self, serializer):
        """Only authorized roles can create fines. Students are blocked at permission level."""
        user = self.request.user
        if user.role == 'student':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Students cannot create disciplinary actions.")
        college = getattr(user, 'college', None)
        save_kwargs = {'college': college} if college is not None else {}
        action_obj = serializer.save(**save_kwargs)

        if (action_obj.fine_amount or Decimal('0')) > Decimal('0'):
            self._record_ledger_entry(
                action_obj,
                entry_type='issued',
                amount=action_obj.fine_amount,
                notes='Initial fine issued at action creation.',
            )

    def perform_update(self, serializer):
        """Track fine adjustments and payment transitions in immutable ledger entries."""
        actor = self.request.user
        previous = serializer.instance
        previous_fine = previous.fine_amount or Decimal('0')
        previous_paid = bool(previous.is_paid)

        action_obj = serializer.save()

        current_fine = action_obj.fine_amount or Decimal('0')
        current_paid = bool(action_obj.is_paid)

        if current_fine != previous_fine:
            delta = current_fine - previous_fine
            self._record_ledger_entry(
                action_obj,
                entry_type='adjustment',
                amount=delta,
                notes=f'Fine adjusted from {previous_fine} to {current_fine}.',
                created_by=actor,
            )

        if not previous_paid and current_paid:
            if action_obj.paid_date is None:
                action_obj.paid_date = timezone.now()
                action_obj.save(update_fields=['paid_date', 'updated_at'])
            self._record_ledger_entry(
                action_obj,
                entry_type='payment',
                amount=current_fine,
                notes='Fine marked as paid.',
                created_by=actor,
            )

        if previous_paid and not current_paid:
            if action_obj.paid_date is not None:
                action_obj.paid_date = None
                action_obj.save(update_fields=['paid_date', 'updated_at'])
            self._record_ledger_entry(
                action_obj,
                entry_type='reopened',
                amount=current_fine,
                notes='Payment status reverted to unpaid.',
                created_by=actor,
            )

    @action(detail=True, methods=['get'])
    def ledger(self, request, pk=None):
        """Return the fine ledger entries for a disciplinary action."""
        action_obj = self.get_object()
        entries = action_obj.ledger_entries.select_related('created_by').all()
        serializer = FineLedgerEntrySerializer(entries, many=True)
        return Response(serializer.data)

    def _record_ledger_entry(self, action_obj, entry_type, amount, notes='', created_by=None):
        balance_after = Decimal('0') if action_obj.is_paid else (action_obj.fine_amount or Decimal('0'))
        FineLedgerEntry.objects.create(
            college=action_obj.college,
            disciplinary_action=action_obj,
            student=action_obj.student,
            entry_type=entry_type,
            amount=amount,
            balance_after=balance_after,
            notes=notes,
            created_by=created_by or self.request.user,
        )
