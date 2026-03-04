"""Rooms app views."""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from django.core.cache import cache
from datetime import date
from django.db import models
from django.db.models import Prefetch, Q
from apps.rooms.models import Room, RoomAllocation, RoomAllocationHistory
from apps.rooms.serializers import RoomSerializer, RoomAllocationSerializer, RoomAllocationHistorySerializer
from apps.auth.models import User
from core.permissions import (
    IsManagement, IsStudent, IsReadOnly, IsStaff, IsAdmin, 
    user_is_admin, MANAGEMENT_ROLES, IsStructuralAuthority, IsWarden
)
from core.role_scopes import get_warden_building_ids, user_is_top_level_management, get_hr_building_ids, get_hr_floor_numbers
from rest_framework.exceptions import PermissionDenied

from apps.rooms.models import Building, Bed
from apps.rooms.serializers import BuildingSerializer, BedSerializer
from apps.colleges.models import College
from websockets.broadcast import broadcast_to_role, broadcast_to_updates_user
import logging

logger = logging.getLogger(__name__)

HOSTEL_MAP_CACHE_VERSION_KEY = 'hostel_map_cache_version'


def _hostel_map_cache_key(user):
    """Build role-aware cache key for room mapping responses."""
    version = cache.get(HOSTEL_MAP_CACHE_VERSION_KEY, 1)
    scope = user.id if user.role in ['warden', 'student'] else 'global'
    return f"hostel_map_v{version}_{user.role}_{scope}"


def invalidate_hostel_map_cache():
    """Invalidate all room-mapping cache variants via version bump."""
    try:
        # Increment version to effectively invalidate all cached map variants
        cache.incr(HOSTEL_MAP_CACHE_VERSION_KEY)
    except (ValueError, TypeError):
        # Fallback if key doesn't exist
        cache.set(HOSTEL_MAP_CACHE_VERSION_KEY, 2, timeout=None)
    # Backward compatibility cleanup for previous single-key cache.
    cache.delete('full_hostel_map')


ROOM_EVENT_ROLES = ['staff', 'admin', 'super_admin', 'warden', 'head_warden', 'student']


def broadcast_room_event(event_type: str, data: dict):
    """Broadcast room-management updates to all management/staff channels."""
    for role in ROOM_EVENT_ROLES:
        broadcast_to_role(role, event_type, data)

class BuildingViewSet(viewsets.ModelViewSet):
    """CRUD for hostel buildings/blocks."""

    queryset = Building.objects.all()
    serializer_class = BuildingSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        """
        Structure Modification (CRUD): Head Warden, Admin, Super Admin.
        View Access: All Management staff (Warden, HR, etc.) or Student (ReadOnly).
        """
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsStructuralAuthority()]
        return [IsAuthenticated(), IsManagement() | (IsStudent() & IsReadOnly())]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        if user_is_top_level_management(user):
            return qs

        # Warden/HR restricted to assigned blocks
        if user.role in ['warden', 'hr'] or getattr(user, 'is_student_hr', False):
            assigned_buildings = get_warden_building_ids(user)
            if not assigned_buildings:
                return qs.none() # No assigned blocks = no access
            return qs.filter(id__in=assigned_buildings)

        return qs

    def perform_create(self, serializer):
        with transaction.atomic():
            building = serializer.save()
            def broadcast_and_invalidate():
                invalidate_hostel_map_cache()
                broadcast_room_event('room_updated', {'resource': 'building', 'building_id': building.id})
            transaction.on_commit(broadcast_and_invalidate)

    def perform_update(self, serializer):
        with transaction.atomic():
            building = serializer.save()
            def broadcast_and_invalidate():
                invalidate_hostel_map_cache()
                broadcast_room_event('room_updated', {'resource': 'building', 'building_id': building.id})
            transaction.on_commit(broadcast_and_invalidate)

    def perform_destroy(self, instance):
        building_id = instance.id
        with transaction.atomic():
            super().perform_destroy(instance)
            def broadcast_and_invalidate():
                invalidate_hostel_map_cache()
                broadcast_room_event('room_updated', {'resource': 'building', 'building_id': building_id})
            transaction.on_commit(broadcast_and_invalidate)


class BedViewSet(viewsets.ModelViewSet):
    """Beds management (Managed via Room)."""

    queryset = Bed.objects.select_related('room').all()
    serializer_class = BedSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [IsAuthenticated(), IsStructuralAuthority()]
        return [IsAuthenticated(), IsManagement() | (IsStudent() & IsReadOnly())]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        
        # Room filter param
        room_id = self.request.query_params.get('room')
        if room_id:
            qs = qs.filter(room_id=room_id)

        if user_is_top_level_management(user):
            return qs

        if user.role in ['warden', 'hr'] or getattr(user, 'is_student_hr', False):
            assigned_buildings = get_warden_building_ids(user)
            floor_numbers = get_hr_floor_numbers(user)
            
            filter_q = Q(room__building_id__in=assigned_buildings)
            if floor_numbers:
                filter_q &= Q(room__floor__in=floor_numbers)
                
            return qs.filter(filter_q)

        # Students only see beds in their assigned room
        if user.role == 'student':
            active_alloc = RoomAllocation.objects.filter(student=user, end_date__isnull=True).first()
            if active_alloc:
                return qs.filter(room_id=active_alloc.room_id)
            return qs.none()

        return qs

class RoomMappingViewSet(viewsets.ReadOnlyModelViewSet):
    """ hierarchical map view with role scoping."""
    queryset = Building.objects.all()
    serializer_class = BuildingSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()
        
        if user_is_top_level_management(user):
            return qs

        if user.role in ['warden', 'hr'] or getattr(user, 'is_student_hr', False):
            assigned_buildings = get_warden_building_ids(user)
            if not assigned_buildings:
                return qs.none()
            return qs.filter(id__in=assigned_buildings)
        
        if user.role == 'student':
            # Students can see the building they are in
            active_alloc = RoomAllocation.objects.filter(student=user, end_date__isnull=True).first()
            if active_alloc:
                return qs.filter(id=active_alloc.room.building_id)
            return qs.none()

        return qs

    def list(self, request, *args, **kwargs):
        user = self.request.user
        is_student = (user.role == 'student')
        
        cache_key = _hostel_map_cache_key(user)
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        active_allocations_qs = (
            RoomAllocation.objects.filter(status='approved', end_date__isnull=True)
            .select_related('student', 'student__tenant')
            .order_by('id')
        )
        buildings = self.get_queryset().prefetch_related(
            'rooms__beds',
            Prefetch('rooms__beds__allocations', queryset=active_allocations_qs, to_attr='active_allocations'),
        )

        # Resolve college code -> name once
        college_map = {c.code: c.name for c in College.objects.all().only('code', 'name')}
        
        data = []
        for building in buildings:
            building_data = {
                'id': building.id,
                'name': building.name,
                'code': building.code,
                'floors': []
            }
            
            rooms_by_floor = {i: [] for i in range(1, building.total_floors + 1)}
            
            for room in building.rooms.all():
                if room.floor not in rooms_by_floor:
                    rooms_by_floor[room.floor] = []
                
                beds = []
                for bed in room.beds.all():
                    active_alloc = (getattr(bed, 'active_allocations', []) or [None])[0]
                    occupant = None
                    if active_alloc:
                        student = active_alloc.student
                        
                        # PRIVACY LAYER: Students only see name/hall ticket of others, 
                        # but see full details of themselves.
                        if is_student and student.id != user.id:
                            occupant = {
                                'id': student.id,
                                'name': student.get_full_name() or student.username,
                                'hall_ticket': student.registration_number or student.username,
                                # Hide phone, college, parent info for other students
                            }
                        else:
                            tenant = getattr(student, 'tenant', None)
                            college_code = getattr(tenant, 'college_code', None)
                            occupant = {
                                'id': student.id,
                                'name': student.get_full_name() or student.username,
                                'reg_no': student.registration_number,
                                'hall_ticket': student.registration_number or student.username,
                                'phone_number': student.phone_number or '',
                                'college_code': college_code,
                                'college_name': college_map.get(college_code) if college_code else None,
                            }
                    
                    beds.append({
                        'id': bed.id,
                        'bed_number': bed.bed_number,
                        'is_occupied': bed.is_occupied,
                        'occupant': occupant
                    })

                rooms_by_floor[room.floor].append({
                    'id': room.id,
                    'room_number': room.room_number,
                    'type': room.room_type,
                    'capacity': room.capacity,
                    'occupancy': room.current_occupancy,
                    'beds': beds
                })
            
            sorted_floors = sorted(rooms_by_floor.keys())
            for floor_num in sorted_floors:
                building_data['floors'].append({
                    'floor_number': floor_num,
                    'rooms': rooms_by_floor[floor_num]
                })
            
            data.append(building_data)
        
        cache.set(cache_key, data, 60)
        return Response(data)

class RoomViewSet(viewsets.ModelViewSet):
    """ViewSet for Room management."""
    queryset = Room.objects.select_related('building').prefetch_related(
        'beds', 
        Prefetch(
            'allocations',
            queryset=RoomAllocation.objects.filter(end_date__isnull=True, status='approved').select_related('student'),
            to_attr='active_allocations_list'
        )
    ).all()
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['floor', 'room_type', 'is_available']
    search_fields = ['room_number', 'description']
    ordering_fields = ['floor', 'room_number', 'rent']

    def get_permissions(self):
        # CRUD Structure: Head Warden+
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'bulk_assign', 'auto_allocate']:
            return [IsAuthenticated(), IsStructuralAuthority()]
        # Allotment/Operations: Warden+
        if self.action in ['allocate', 'deallocate', 'generate_beds', 'sync_inventory']:
            return [IsAuthenticated(), IsWarden()]
        return [IsAuthenticated(), IsManagement()]

    @action(detail=False, methods=['post'])
    def bulk_assign(self, request):
        """Bulk assign rooms using bulk_create."""
        # Permissions handled by get_permissions
        
        allocations_data = request.data.get('allocations', [])
        to_create = []
        
        with transaction.atomic():
            for data in allocations_data:
                serializer = RoomAllocationSerializer(data=data)
                if serializer.is_valid():
                    # Warden/HR cannot mutate rooms outside their scope
                    room_id = serializer.validated_data.get('room').id
                    if not self.get_queryset().filter(id=room_id).exists():
                        raise PermissionDenied("You do not have permission to allocate to this room.")
                    
                    to_create.append(RoomAllocation(**serializer.validated_data))
            
            if to_create:
                RoomAllocation.objects.bulk_create(to_create)
                
                # Fix: Update Bed and Room stats explicitly
                bed_ids = [ra.bed_id for ra in to_create if ra.bed_id]
                if bed_ids:
                    Bed.objects.filter(id__in=bed_ids).update(is_occupied=True)
                
                room_ids = list(set([ra.room_id for ra in to_create]))
                # DSA OPTIMIZATION: Use Group By instead of manual loop for O(1) DB calls
                # This reduces N queries to 2 queries total
                occupancy_stats = RoomAllocation.objects.filter(
                    room_id__in=room_ids,
                    end_date__isnull=True,
                    status='approved'
                ).values('room_id').annotate(count=models.Count('id'))
                
                for stat in occupancy_stats:
                    Room.objects.filter(id=stat['room_id']).update(current_occupancy=stat['count'])
            
            def invalidate_cache():
                invalidate_hostel_map_cache()
                broadcast_room_event('room_updated', {'resource': 'bulk_assign'})
                
            transaction.on_commit(invalidate_cache)

        return Response({'detail': f'Successfully allocated {len(to_create)} students.'}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def auto_allocate(self, request):
        """Automatically allocate all unallocated students to available rooms."""
        from apps.auth.models import User
        from django.db import DatabaseError

        # Permissions handled by get_permissions

        with transaction.atomic():
            students = User.objects.filter(role='student')
            unallocated_students = []
            
            for s in students:
                if not RoomAllocation.objects.filter(student=s, end_date__isnull=True).exists():
                   unallocated_students.append(s)
                   
            if not unallocated_students:
                return Response({'detail': 'All students are already allocated.'}, status=status.HTTP_200_OK)

            # Filter rooms based on user's permissions
            rooms = self.get_queryset().order_by('building__id', 'floor', 'room_number')
            allocated_count = 0
            
            for student in unallocated_students:
                allocated = False
                for room in rooms:
                    try:
                        current_room = Room.objects.select_for_update(nowait=True).get(id=room.id)
                    except DatabaseError:
                        continue
                        
                    if current_room.current_occupancy < current_room.capacity:
                        try:
                            bed = Bed.objects.select_for_update(nowait=True).filter(room=current_room, is_occupied=False).first()
                        except DatabaseError:
                            continue
                            
                        if not bed:
                            bed = Bed.objects.create(room=current_room, bed_number=f'{current_room.room_number}-X{current_room.current_occupancy + 1}')
                        
                        RoomAllocation.objects.create(
                            room=current_room,
                            bed=bed,
                            student=student,
                            status='approved',
                            allocated_date=date.today(),
                            changed_by=request.user
                        )
                        
                        bed.is_occupied = True
                        bed.save()
                        
                        current_room.current_occupancy += 1
                        current_room.save(update_fields=['current_occupancy'])
                        
                        RoomAllocationHistory.objects.create(
                            student=student,
                            action='allocated',
                            to_room=current_room,
                            to_bed=bed,
                            changed_by=request.user,
                            details=f"Auto-allocated"
                        )
                        
                        allocated_count += 1
                        allocated = True
                        break
            
            def invalidate_cache():
                invalidate_hostel_map_cache()
                broadcast_room_event('room_updated', {'resource': 'auto_allocate'})
                
            transaction.on_commit(invalidate_cache)

        if allocated_count < len(unallocated_students):
            return Response({
                'detail': f'Allocated {allocated_count} students. Not enough capacity for {len(unallocated_students) - allocated_count} students.'
            }, status=status.HTTP_200_OK)
            
        return Response({'detail': f'Successfully auto-allocated {allocated_count} students.'}, status=status.HTTP_200_OK)

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get('status')

        if status_filter == 'available':
            queryset = queryset.filter(is_available=True, current_occupancy__lt=models.F('capacity'))
        elif status_filter == 'occupied':
            queryset = queryset.filter(current_occupancy__gte=models.F('capacity'))
        elif status_filter == 'maintenance':
            queryset = queryset.filter(is_available=False)

        if user_is_top_level_management(user):
            return queryset

        if user.role in ['warden', 'hr'] or getattr(user, 'is_student_hr', False):
            assigned_buildings = get_warden_building_ids(user)
            floor_numbers = get_hr_floor_numbers(user)
            
            filter_q = Q(building_id__in=assigned_buildings)
            if floor_numbers:
                filter_q &= Q(floor__in=floor_numbers)
                
            return queryset.filter(filter_q)

        if user.role == 'student':
            active_alloc = RoomAllocation.objects.filter(student=user, end_date__isnull=True).first()
            if active_alloc:
                # Students can ONLY see their own room for privacy
                return queryset.filter(id=active_alloc.room_id)
            return queryset.none()

        return queryset

    def _generate_beds(self, room):
        """Helper to generate beds using bulk_create."""
        created_count = 0
        
        existing_beds = set(Bed.objects.filter(room=room).values_list('bed_number', flat=True))
        to_create = []

        # Generate beds based on capacity and the new naming convention
        # Format: RoomNumber-Floor-BedNumber (e.g., 102-1-1, 102-1-2)
        
        num_beds = room.capacity or 0
        
        for i in range(1, num_beds + 1):
            bed_num = f"{room.room_number}-{room.floor}-{i}"
            if bed_num not in existing_beds:
                to_create.append(Bed(room=room, bed_number=bed_num))
        
        if to_create:
            Bed.objects.bulk_create(to_create)
            created_count = len(to_create)
            
        return created_count

    def perform_create(self, serializer):
        with transaction.atomic():
            room = serializer.save(created_by=self.request.user)
            
            # Auto-generate beds using the consolidated helper
            self._generate_beds(room)
            
            def broadcast_and_invalidate():
                invalidate_hostel_map_cache()
                broadcast_room_event('room_updated', {'room_id': room.id, 'resource': 'room'})
                
            transaction.on_commit(broadcast_and_invalidate)

    def perform_update(self, serializer):
        with transaction.atomic():
            room = serializer.save()
            # Optionally regenerate/backfill if capacity increased? 
            # For now, safe to just leave it manual or auto-fill missing
            self._generate_beds(room) 
            
            def broadcast_and_invalidate():
                invalidate_hostel_map_cache()
                broadcast_room_event('room_updated', {'room_id': room.id, 'resource': 'room'})
                
            transaction.on_commit(broadcast_and_invalidate)

    def perform_destroy(self, instance):
        # Safety Check: Don't delete room if it has active allocations
        if RoomAllocation.objects.filter(room=instance, status='approved', end_date__isnull=True).exists():
             from rest_framework.exceptions import ValidationError
             raise ValidationError("Cannot delete room with active students. Deallocate them first.")
             
        room_id = instance.id
        
        with transaction.atomic():
            super().perform_destroy(instance)
            
            def broadcast_and_invalidate():
                invalidate_hostel_map_cache()
                broadcast_room_event('room_updated', {'room_id': room_id, 'resource': 'room'})
            
            transaction.on_commit(broadcast_and_invalidate)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsManagement])
    def generate_beds(self, request, pk=None):
        """Create missing Bed rows for a room based on its capacity."""
        with transaction.atomic():
            # self.get_object() automatically enforces get_queryset scope (Warden building isolation)
            room = self.get_object()
            created = self._generate_beds(room)
            
            def broadcast_and_invalidate():
                invalidate_hostel_map_cache()
                broadcast_room_event('room_updated', {'room_id': room.id, 'resource': 'room'})
                
            transaction.on_commit(broadcast_and_invalidate)
            return Response({'created': created}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsManagement])
    def sync_inventory(self, request, pk=None):
        """Re-synchronize bed occupancy and room current_occupancy with allocations."""
        with transaction.atomic():
            room = self.get_object()
            
            # Sync beds
            beds = Bed.objects.filter(room=room)
            for bed in beds:
                active_alloc_exists = RoomAllocation.objects.filter(
                    bed=bed, 
                    end_date__isnull=True, 
                    status='approved'
                ).exists()
                if bed.is_occupied != active_alloc_exists:
                    bed.is_occupied = active_alloc_exists
                    bed.save(update_fields=['is_occupied'])

            # Sync room occupancy
            actual_occupancy = RoomAllocation.objects.filter(
                room=room,
                end_date__isnull=True,
                status='approved',
            ).count()
            
            if room.current_occupancy != actual_occupancy:
                room.current_occupancy = actual_occupancy
                room.save(update_fields=['current_occupancy'])

            def broadcast():
                invalidate_hostel_map_cache()
                broadcast_room_event('room_updated', {'room_id': room.id, 'resource': 'room'})
            transaction.on_commit(broadcast)
            
            return Response({'detail': 'Room inventory synchronized.'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def allocate(self, request, pk=None):
        """
        Allocate a room/bed to a student.
        
        CONCURRENCY FIX v2:
        - Retry loop (2 attempts) instead of nowait=True immediate fail
        - Optimistic locking via room_updated_at (optional client hint)
        - skip_locked=True for bed auto-pick
        - On conflict: returns fresh room state so client can auto-retry
        """
        import time
        from django.db import DatabaseError
        
        student_id = request.data.get('user_id') or request.data.get('student_id')
        bed_id = request.data.get('bed_id')
        client_updated_at = request.data.get('room_updated_at')  # Optimistic lock hint
        
        if not student_id:
            return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate student exists (outside transaction — no lock needed)
        try:
            student = User.objects.get(id=student_id)
        except User.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        MAX_RETRIES = 2
        RETRY_DELAY = 0.3  # seconds
        
        for attempt in range(MAX_RETRIES):
            broadcast_data = None
            try:
                with transaction.atomic():
                    # LOCK the room row — use of_=('self',) with a short wait
                    try:
                        room = (
                            self.get_queryset()
                            .select_for_update(nowait=(attempt < MAX_RETRIES - 1))
                            .get(pk=pk)
                        )
                    except Room.DoesNotExist:
                        return Response(
                            {'detail': 'Room not found or no authority over this building.'},
                            status=status.HTTP_404_NOT_FOUND,
                        )
                    except DatabaseError:
                        if attempt < MAX_RETRIES - 1:
                            time.sleep(RETRY_DELAY)
                            continue  # Retry
                        # Final attempt: return conflict with fresh room state
                        try:
                            fresh = self.get_queryset().get(pk=pk)
                            return Response({
                                'detail': 'Room is busy. Please try again.',
                                'fresh_room': RoomSerializer(fresh).data,
                            }, status=status.HTTP_409_CONFLICT)
                        except Room.DoesNotExist:
                            return Response(
                                {'detail': 'Room not found.'},
                                status=status.HTTP_404_NOT_FOUND,
                            )

                    # ── OPTIMISTIC LOCK CHECK ──
                    # If client sends room_updated_at, verify room hasn't changed
                    if client_updated_at:
                        from django.utils.dateparse import parse_datetime
                        client_ts = parse_datetime(client_updated_at)
                        if client_ts and room.updated_at and room.updated_at > client_ts:
                            return Response({
                                'detail': 'Room state has changed since you last loaded. Refreshing…',
                                'fresh_room': RoomSerializer(room).data,
                            }, status=status.HTTP_409_CONFLICT)

                    if not room.is_available:
                        return Response({'detail': 'Room is under maintenance.'}, status=status.HTTP_400_BAD_REQUEST)

                    # Check occupancy (count under the room lock — safe)
                    active_occupancy = RoomAllocation.objects.filter(
                        room=room,
                        end_date__isnull=True,
                        status='approved',
                    ).count()

                    if active_occupancy >= room.capacity:
                        return Response({'detail': 'Room is full.'}, status=status.HTTP_400_BAD_REQUEST)

                    # Check student not already allocated
                    try:
                        already_allocated = RoomAllocation.objects.filter(
                            student=student,
                            end_date__isnull=True,
                        ).select_for_update(nowait=(attempt < MAX_RETRIES - 1)).exists()
                    except DatabaseError:
                        if attempt < MAX_RETRIES - 1:
                            time.sleep(RETRY_DELAY)
                            continue
                        return Response({
                            'detail': 'Student allocation is being modified. Please try again.',
                        }, status=status.HTTP_409_CONFLICT)

                    if already_allocated:
                        return Response({'detail': 'Student already allocated to a room.'}, status=status.HTTP_400_BAD_REQUEST)

                    # ── BED SELECTION ──
                    bed = None
                    if bed_id:
                        try:
                            bed = Bed.objects.select_for_update(nowait=(attempt < MAX_RETRIES - 1)).get(id=bed_id, room=room)
                            if bed.is_occupied:
                                return Response({'detail': 'Bed is already occupied.'}, status=status.HTTP_400_BAD_REQUEST)
                        except DatabaseError:
                            if attempt < MAX_RETRIES - 1:
                                time.sleep(RETRY_DELAY)
                                continue
                            return Response({
                                'detail': 'Bed is being modified. Please try again.',
                            }, status=status.HTTP_409_CONFLICT)
                        except Bed.DoesNotExist:
                            return Response({'detail': 'Bed not found in this room.'}, status=status.HTTP_404_NOT_FOUND)
                    else:
                        # Auto-pick a free bed — use skip_locked to avoid contention
                        if not room.beds.exists():
                            for i in range(1, (room.capacity or 0) + 1):
                                Bed.objects.get_or_create(room=room, bed_number=str(i))

                        bed = (
                            Bed.objects.select_for_update(skip_locked=True)
                            .filter(room=room, is_occupied=False)
                            .order_by('id')
                            .first()
                        )
                        if not bed:
                            return Response({'detail': 'No available bed in this room.'}, status=status.HTTP_400_BAD_REQUEST)

                    # ── CREATE ALLOCATION ──
                    allocation = RoomAllocation.objects.create(
                        room=room,
                        bed=bed,
                        student=student,
                        status='approved',
                        allocated_date=date.today(),
                    )

                    RoomAllocationHistory.objects.create(
                        student=student,
                        action='allocated',
                        to_room=room,
                        to_bed=bed,
                        changed_by=request.user,
                        details=f"Allocated to {room.room_number}" + (f" Bed {bed.bed_number}" if bed else ""),
                    )

                    if bed:
                        bed.is_occupied = True
                        bed.save(update_fields=['is_occupied'])

                    room.current_occupancy = RoomAllocation.objects.filter(
                        room=room,
                        end_date__isnull=True,
                        status='approved',
                    ).count()
                    room.save(update_fields=['current_occupancy', 'updated_at'])

                    broadcast_data = {
                        'student_id': student.id,
                        'room_id': room.id,
                        'room_number': room.room_number,
                        'bed_id': bed.id if bed else None,
                    }

                    # Transaction commits HERE — locks released

                # Broadcasts AFTER commit
                def send_broadcasts():
                    invalidate_hostel_map_cache()
                    broadcast_to_updates_user(broadcast_data['student_id'], 'room_allocated', {
                        'room_id': broadcast_data['room_id'],
                        'room_number': broadcast_data['room_number'],
                        'bed_id': broadcast_data['bed_id'],
                        'resource': 'room',
                    })
                    broadcast_room_event('room_allocated', {
                        'room_id': broadcast_data['room_id'],
                        'room_number': broadcast_data['room_number'],
                        'user_id': broadcast_data['student_id'],
                        'bed_id': broadcast_data['bed_id'],
                        'resource': 'room',
                    })
                    broadcast_room_event('room_updated', {'room_id': broadcast_data['room_id'], 'resource': 'room'})

                if broadcast_data:
                    transaction.on_commit(send_broadcasts)

                return Response(RoomSerializer(room).data, status=status.HTTP_200_OK)

            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_DELAY)
                    continue
                logger.error(f"Room allocation error: {e}", exc_info=True)
                return Response({
                    'detail': 'An error occurred during allocation. Please try again.',
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Should never reach here, but just in case
        return Response({
            'detail': 'Allocation failed after retries. Please try again.',
        }, status=status.HTTP_409_CONFLICT)

    @action(detail=True, methods=['post', 'delete'])
    def deallocate(self, request, pk=None):
        """Deallocate a student from a room with role-based scope enforcement."""
        from django.db import DatabaseError
        broadcast_data = None
        
        try:
            with transaction.atomic():
                try:
                    room = self.get_queryset().select_for_update(nowait=True).get(pk=pk)
                except Room.DoesNotExist:
                     return Response({'detail': 'Room not found or no authority over this building.'}, status=status.HTTP_404_NOT_FOUND)
                except DatabaseError:
                    return Response({'detail': 'Room is locked.'}, status=status.HTTP_409_CONFLICT)
                
                raw_student_id = request.data.get('user_id') or request.data.get('student_id')
                if not raw_student_id:
                    return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
                
                try:
                    student_id = int(raw_student_id)
                except (ValueError, TypeError):
                    return Response({'detail': 'Invalid student ID.'}, status=status.HTTP_400_BAD_REQUEST)

                # Lock allocation specifically for 'approved' status which is what we see in the map
                try:
                    allocation = RoomAllocation.objects.filter(
                        room=room,
                        student_id=student_id,
                        status='approved',
                        end_date__isnull=True
                    ).select_for_update(nowait=True).first()
                except DatabaseError:
                    return Response({
                        'detail': 'Allocation is being modified. Please try again.'
                    }, status=status.HTTP_409_CONFLICT)

                if not allocation:
                    return Response({'detail': 'Active approved allocation not found for this student in this room.'}, status=status.HTTP_404_NOT_FOUND)

                allocation.end_date = date.today()
                allocation.status = 'completed'
                allocation.save(update_fields=['end_date', 'status'])
                
                # Track deallocation history
                RoomAllocationHistory.objects.create(
                    student_id=student_id,
                    action='deallocated',
                    from_room=room,
                    from_bed=allocation.bed,
                    changed_by=request.user,
                    details=f"Deallocated from {room.room_number}",
                )
                
                if allocation.bed:
                    # Lock and update bed status
                    try:
                        bed = Bed.objects.select_for_update(nowait=True).get(id=allocation.bed_id)
                        bed.is_occupied = False
                        bed.save(update_fields=['is_occupied'])
                    except DatabaseError:
                        return Response({'detail': 'Bed is locked by another process.'}, status=status.HTTP_409_CONFLICT)

                # Recalculate occupancy
                room.current_occupancy = RoomAllocation.objects.filter(
                    room=room,
                    end_date__isnull=True,
                    status='approved',
                ).count()
                room.save(update_fields=['current_occupancy'])
                
                # Store for broadcasts after commit
                broadcast_data = {
                    'student_id': student_id,
                    'room_id': room.id,
                    'room_number': room.room_number,
                }
                
                # Transaction commits here
            
            # Broadcasts OUTSIDE transaction
            def send_broadcasts():
                invalidate_hostel_map_cache()
                if broadcast_data:
                    broadcast_to_updates_user(broadcast_data['student_id'], 'room_deallocated', {
                        'room_id': broadcast_data['room_id'],
                        'room_number': broadcast_data['room_number'],
                        'resource': 'room',
                    })
                    broadcast_room_event('room_deallocated', {
                        'room_id': broadcast_data['room_id'],
                        'room_number': broadcast_data['room_number'],
                        'user_id': broadcast_data['student_id'],
                        'resource': 'room',
                    })
                    broadcast_room_event('room_updated', {'room_id': broadcast_data['room_id'], 'resource': 'room'})

            transaction.on_commit(send_broadcasts)

            return Response({'detail': 'Room deallocated successfully.'}, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Room deallocation error: {e}", exc_info=True)
            return Response({
                'detail': f'An error occurred: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RoomAllocationViewSet(viewsets.ModelViewSet):
    """ViewSet for Room Allocation management."""
    queryset = RoomAllocation.objects.all()
    serializer_class = RoomAllocationSerializer
    permission_classes = [IsAuthenticated, IsManagement | IsStudent]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'room', 'student']
    search_fields = ['student__username', 'room__room_number']
    ordering_fields = ['allocated_date', 'created_at']

    def get_queryset(self):
        user = self.request.user
        qs = super().get_queryset()

        if user_is_top_level_management(user):
            return qs

        if user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            return qs.filter(room__building_id__in=warden_buildings)

        if user.role == 'student':
            # Students can see their own allocations
            return qs.filter(student=user)

        return qs

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def my_active(self, request):
        """Return the authenticated user's current active room/bed allocation (if any)."""
        allocation = (
            RoomAllocation.objects.select_related('room__building', 'bed')
            .filter(student=request.user, status='approved', end_date__isnull=True)
            .order_by('-allocated_date', '-created_at')
            .first()
        )
        if not allocation:
            return Response(None, status=status.HTTP_200_OK)

        room = allocation.room
        building = room.building if room else None
        bed = allocation.bed

        return Response(
            {
                'id': allocation.id,
                'allocated_date': allocation.allocated_date,
                'room': {
                    'id': room.id,
                    'room_number': room.room_number,
                    'floor': room.floor,
                    'building': {
                        'id': building.id if building else None,
                        'code': building.code if building else None,
                        'name': building.name if building else None,
                    },
                },
                'bed': {
                    'id': bed.id if bed else None,
                    'bed_number': bed.bed_number if bed else None,
                },
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsManagement])
    def move(self, request):
        """
        Move a student from their current (active) allocation to a target bed.

        Payload:
        - student_id (required)
        - target_bed_id (required)
        """
        student_id = request.data.get('student_id')
        target_bed_id = request.data.get('target_bed_id')

        if not student_id or not target_bed_id:
            return Response(
                {'detail': 'student_id and target_bed_id are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            current_alloc = RoomAllocation.objects.select_for_update().select_related(
                'room', 'bed', 'student'
            ).filter(
                student_id=student_id,
                end_date__isnull=True,
                status='approved',
            ).first()

            if not current_alloc:
                return Response({'detail': 'Active allocation not found.'}, status=status.HTTP_404_NOT_FOUND)

            target_bed = Bed.objects.select_for_update().select_related('room').filter(id=target_bed_id).first()
            if not target_bed:
                return Response({'detail': 'Target bed not found.'}, status=status.HTTP_404_NOT_FOUND)

            target_room = Room.objects.select_for_update().get(id=target_bed.room_id)

            if not target_room.is_available:
                return Response({'detail': 'Target room is under maintenance.'}, status=status.HTTP_400_BAD_REQUEST)

            if target_bed.is_occupied or target_bed.allocations.filter(status='approved', end_date__isnull=True).exists():
                return Response({'detail': 'Target bed is already occupied.'}, status=status.HTTP_400_BAD_REQUEST)

            # No-op move
            if current_alloc.bed_id == target_bed.id:
                return Response({'detail': 'Student is already in the selected bed.'}, status=status.HTTP_200_OK)

            old_room = current_alloc.room
            old_bed = current_alloc.bed

            # Close existing allocation
            current_alloc.end_date = date.today()
            current_alloc.status = 'completed'
            current_alloc.save(update_fields=['end_date', 'status'])

            # Free old bed if any
            if old_bed:
                old_bed.is_occupied = False
                old_bed.save(update_fields=['is_occupied'])

            # Create new allocation
            new_alloc = RoomAllocation.objects.create(
                student=current_alloc.student,
                room=target_room,
                bed=target_bed,
                status='approved',
                allocated_date=date.today(),
            )
            target_bed.is_occupied = True
            target_bed.save(update_fields=['is_occupied'])

            # Track move history
            RoomAllocationHistory.objects.create(
                student=current_alloc.student,
                action='moved',
                from_room=old_room,
                from_bed=old_bed,
                to_room=target_room,
                to_bed=target_bed,
                changed_by=request.user,
                details=f"Moved from {old_room.room_number} to {target_room.room_number}",
            )

            # Sync room occupancy counts
            old_room.current_occupancy = RoomAllocation.objects.filter(
                room=old_room,
                end_date__isnull=True,
                status='approved',
            ).count()
            old_room.save(update_fields=['current_occupancy'])

            if target_room.id != old_room.id:
                target_room.current_occupancy = RoomAllocation.objects.filter(
                    room=target_room,
                    end_date__isnull=True,
                    status='approved',
                ).count()
                target_room.save(update_fields=['current_occupancy'])

            # Prepare broadcast data
            broadcast_params = {
                'user_id': int(student_id),
                'from_room_id': old_room.id,
                'to_room_id': target_room.id,
                'from_bed_id': old_bed.id if old_bed else None,
                'to_bed_id': target_bed.id,
                'resource': 'room',
            }
                
            # Broadcast outside transaction
            def send_broadcasts():
                invalidate_hostel_map_cache()
                
                broadcast_to_updates_user(int(student_id), 'room_moved', broadcast_params)
                
                # Use management channel for staff updates
                from websockets.broadcast import broadcast_to_management
                broadcast_to_management('room_moved', broadcast_params)
                
                # Individual room updates (could be optimized, but ok for now)
                broadcast_room_event('room_updated', {'room_id': old_room.id, 'resource': 'room'})
                broadcast_room_event('room_updated', {'room_id': target_room.id, 'resource': 'room'})

            transaction.on_commit(send_broadcasts)

            serializer = self.get_serializer(new_alloc)
            return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], permission_classes=[IsAuthenticated])
    def history(self, request):
        """Return room allocation history. Staff see all; students see their own."""
        user = request.user
        qs = RoomAllocationHistory.objects.select_related(
            'student', 'from_room', 'to_room', 'from_bed', 'to_bed', 'changed_by'
        )

        if user.role == 'student':
            qs = qs.filter(student=user)
        elif user.role == 'warden':
            warden_buildings = get_warden_building_ids(user)
            qs = qs.filter(
                models.Q(from_room__building_id__in=warden_buildings) |
                models.Q(to_room__building_id__in=warden_buildings)
            )
        elif not user_is_top_level_management(user):
            qs = qs.none()

        student_id = request.query_params.get('student_id')
        if student_id:
            qs = qs.filter(student_id=student_id)

        qs = qs.order_by('-created_at')[:100]
        serializer = RoomAllocationHistorySerializer(qs, many=True)
        return Response(serializer.data)
