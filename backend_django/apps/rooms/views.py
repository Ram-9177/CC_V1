"""Rooms app views."""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from datetime import date
from django.db import models
from django.db.models import Prefetch
from apps.rooms.models import Room, RoomAllocation
from apps.rooms.serializers import RoomSerializer, RoomAllocationSerializer
from apps.auth.models import User
from core.permissions import IsAdmin, IsChef, IsStaff, IsWarden, user_is_admin, user_is_staff

from apps.rooms.models import Building, Bed
from apps.rooms.serializers import BuildingSerializer, BedSerializer
from apps.colleges.models import College
from websockets.broadcast import broadcast_to_role, broadcast_to_updates_user

class BuildingViewSet(viewsets.ModelViewSet):
    """CRUD for hostel buildings/blocks."""

    queryset = Building.objects.all()
    serializer_class = BuildingSerializer
    permission_classes = [IsAuthenticated, IsAdmin | IsWarden]


class BedViewSet(viewsets.ModelViewSet):
    """CRUD for beds (mostly managed via Room.generate_beds)."""

    queryset = Bed.objects.select_related('room').all()
    serializer_class = BedSerializer
    permission_classes = [IsAuthenticated, IsAdmin | IsWarden]

    def get_queryset(self):
        qs = super().get_queryset()
        room_id = self.request.query_params.get('room')
        if room_id:
            qs = qs.filter(room_id=room_id)
        return qs

class RoomMappingViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ReadOnly ViewSet to retrieve the full hierarchical map of the hostel.
    Structure: Building -> Floors -> Rooms -> Beds
    """
    queryset = Building.objects.all()
    serializer_class = BuildingSerializer
    # Everyone except students + security can view full room mapping.
    permission_classes = [IsAuthenticated, IsStaff | IsChef]

    def list(self, request, *args, **kwargs):
        active_allocations_qs = (
            RoomAllocation.objects.filter(status='approved', end_date__isnull=True)
            .select_related('student', 'student__tenant')
            .order_by('id')
        )
        buildings = self.get_queryset().prefetch_related(
            'rooms__beds',
            Prefetch('rooms__beds__allocations', queryset=active_allocations_qs, to_attr='active_allocations'),
        )

        # Resolve college code -> name once, to avoid N+1 queries.
        college_codes = set()
        for building in buildings:
            for room in building.rooms.all():
                for bed in room.beds.all():
                    active_alloc = (getattr(bed, 'active_allocations', []) or [None])[0]
                    if not active_alloc:
                        continue
                    tenant = getattr(active_alloc.student, 'tenant', None)
                    code = getattr(tenant, 'college_code', None)
                    if code:
                        college_codes.add(code)

        college_map = {}
        if college_codes:
            college_map = {c.code: c.name for c in College.objects.filter(code__in=college_codes)}
        
        data = []
        for building in buildings:
            building_data = {
                'id': building.id,
                'name': building.name,
                'code': building.code,
                'floors': []
            }
            
            # Group rooms by floor
            rooms_by_floor = {}
            for room in building.rooms.all():
                if room.floor not in rooms_by_floor:
                    rooms_by_floor[room.floor] = []
                
                beds = []
                for bed in room.beds.all():
                    active_alloc = (getattr(bed, 'active_allocations', []) or [None])[0]
                    occupant = None
                    if active_alloc:
                        student = active_alloc.student
                        tenant = getattr(student, 'tenant', None)
                        college_code = getattr(tenant, 'college_code', None)
                        occupant = {
                            'id': student.id,
                            'name': student.get_full_name() or student.username,
                            # Back-compat with existing frontend
                            'reg_no': student.registration_number,
                            # Rich hover details
                            'hall_ticket': student.registration_number or student.username,
                            'phone_number': student.phone_number or '',
                            'college_code': college_code,
                            'college_name': college_map.get(college_code) if college_code else None,
                            'father_phone': getattr(tenant, 'father_phone', '') if tenant else '',
                            'mother_phone': getattr(tenant, 'mother_phone', '') if tenant else '',
                            'guardian_phone': getattr(tenant, 'guardian_phone', '') if tenant else '',
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
            
            # Structure floors
            for floor_num, rooms in rooms_by_floor.items():
                building_data['floors'].append({
                    'floor_number': floor_num,
                    'rooms': rooms
                })
            
            building_data['floors'].sort(key=lambda x: x['floor_number'])
            data.append(building_data)
            
        return Response(data)

class RoomViewSet(viewsets.ModelViewSet):
    """ViewSet for Room management."""
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated, IsStaff | IsChef]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['floor', 'room_type', 'is_available']
    search_fields = ['room_number', 'description']
    ordering_fields = ['floor', 'room_number', 'rent']

    def _broadcast_event(self, event_type: str, data: dict):
        # Fan-out to all staff-like roles who can see room management.
        for role in ['staff', 'admin', 'super_admin', 'warden', 'head_warden']:
            broadcast_to_role(role, event_type, data)
    
    @action(detail=True, methods=['post'])
    def bulk_assign(self, request):
        """Bulk assign rooms to students."""
        if not (user_is_admin(request.user) or user_is_staff(request.user)):
            return Response({'detail': 'Not authorized.'}, status=status.HTTP_403_FORBIDDEN)
        allocations = request.data.get('allocations', [])
        created = []
        
        for allocation_data in allocations:
            serializer = RoomAllocationSerializer(data=allocation_data)
            if serializer.is_valid():
                serializer.save()
                created.append(serializer.data)
        
        return Response(created, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get('status')

        if status_filter == 'available':
            queryset = queryset.filter(is_available=True, current_occupancy__lt=models.F('capacity'))
        elif status_filter == 'occupied':
            queryset = queryset.filter(current_occupancy__gte=models.F('capacity'))
        elif status_filter == 'maintenance':
            queryset = queryset.filter(is_available=False)

        return queryset

    def perform_create(self, serializer):
        room = serializer.save(created_by=self.request.user)
        self._broadcast_event('room_updated', {'room_id': room.id, 'resource': 'room'})

    def perform_update(self, serializer):
        room = serializer.save()
        self._broadcast_event('room_updated', {'room_id': room.id, 'resource': 'room'})

    def perform_destroy(self, instance):
        room_id = instance.id
        super().perform_destroy(instance)
        self._broadcast_event('room_updated', {'room_id': room_id, 'resource': 'room'})

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsStaff | IsChef])
    def generate_beds(self, request, pk=None):
        """Create missing Bed rows for a room based on its capacity."""
        with transaction.atomic():
            room = Room.objects.select_for_update().get(pk=pk)
            created = 0
            for i in range(1, (room.capacity or 0) + 1):
                _, was_created = Bed.objects.get_or_create(room=room, bed_number=str(i))
                if was_created:
                    created += 1
            return Response({'created': created}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsStaff | IsChef])
    def allocate(self, request, pk=None):
        """
        Allocate a room/bed to a student.
        
        CONCURRENCY FIX: Uses nowait=True to prevent deadlocks.
        If locks can't be acquired immediately, returns 409 Conflict.
        """
        from django.db import DatabaseError
        
        # Variables to store for broadcasts AFTER transaction
        broadcast_data = None
        
        try:
            with transaction.atomic():
                # LOCK 1: Lock the room (fail fast if already locked)
                try:
                    room = Room.objects.select_for_update(nowait=True).get(pk=pk)
                except DatabaseError:
                    return Response({
                        'detail': 'Room is currently being modified by another user. Please try again.'
                    }, status=status.HTTP_409_CONFLICT)
                
                student_id = request.data.get('user_id') or request.data.get('student_id')
                bed_id = request.data.get('bed_id')

                if not student_id:
                    return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

                if not room.is_available:
                    return Response({'detail': 'Room is under maintenance.'}, status=status.HTTP_400_BAD_REQUEST)

                try:
                    student = User.objects.get(id=student_id)
                except User.DoesNotExist:
                    return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

                # LOCK 2: Check occupancy WITHOUT locking (DB constraint is safety net)
                # Rationale: Locking ALL allocations causes deadlocks on free tier
                # The UNIQUE constraint will catch any race condition
                active_occupancy = RoomAllocation.objects.filter(
                    room=room,
                    end_date__isnull=True,
                    status='approved',
                ).count()

                if active_occupancy >= room.capacity:
                    return Response({'detail': 'Room is full.'}, status=status.HTTP_400_BAD_REQUEST)

                # LOCK 3: Check if student already allocated (with nowait)
                try:
                    active_alloc = RoomAllocation.objects.filter(
                        student=student,
                        end_date__isnull=True
                    ).select_for_update(nowait=True).exists()
                except DatabaseError:
                    return Response({
                        'detail': 'Student allocation is being modified. Please try again.'
                    }, status=status.HTTP_409_CONFLICT)
                
                if active_alloc:
                    return Response({'detail': 'Student already allocated to a room.'}, status=status.HTTP_400_BAD_REQUEST)

                bed = None
                if bed_id:
                    try:
                        bed = Bed.objects.select_for_update(nowait=True).get(id=bed_id, room=room)
                        if bed.is_occupied:
                            return Response({'detail': 'Bed is already occupied.'}, status=status.HTTP_400_BAD_REQUEST)
                    except DatabaseError:
                        return Response({
                            'detail': 'Bed is being modified. Please try again.'
                        }, status=status.HTTP_409_CONFLICT)
                    except Bed.DoesNotExist:
                         return Response({'detail': 'Bed not found in this room.'}, status=status.HTTP_404_NOT_FOUND)
                else:
                    # RoomsPage allocates without a bed_id; pick a free bed automatically so
                    # bed-level mapping stays accurate.
                    if not room.beds.exists():
                        for i in range(1, (room.capacity or 0) + 1):
                            Bed.objects.get_or_create(room=room, bed_number=str(i))

                    try:
                        bed = (
                            Bed.objects.select_for_update(nowait=True)
                            .filter(room=room, is_occupied=False)
                            .order_by('id')
                            .first()
                        )
                    except DatabaseError:
                        return Response({
                            'detail': 'Beds are being modified. Please try again.'
                        }, status=status.HTTP_409_CONFLICT)
                    
                    if not bed:
                        return Response({'detail': 'No available bed in this room.'}, status=status.HTTP_400_BAD_REQUEST)

                allocation = RoomAllocation.objects.create(
                    room=room,
                    bed=bed,
                    student=student,
                    status='approved',
                    allocated_date=date.today(),
                )
                
                if bed:
                    bed.is_occupied = True
                    bed.save()

                room.current_occupancy = RoomAllocation.objects.filter(
                    room=room,
                    end_date__isnull=True,
                    status='approved',
                ).count()
                room.save(update_fields=['current_occupancy'])
                
                # Store data for broadcasts AFTER transaction commits
                broadcast_data = {
                    'student_id': student.id,
                    'room_id': room.id,
                    'room_number': room.room_number,
                    'bed_id': bed.id if bed else None,
                }
                
                # Transaction commits HERE - locks released FAST!
            
            # FIX #2: Broadcasts OUTSIDE transaction (no locks held)
            if broadcast_data:
                broadcast_to_updates_user(broadcast_data['student_id'], 'room_allocated', {
                    'room_id': broadcast_data['room_id'],
                    'room_number': broadcast_data['room_number'],
                    'bed_id': broadcast_data['bed_id'],
                    'resource': 'room',
                })
                self._broadcast_event('room_allocated', {
                    'room_id': broadcast_data['room_id'],
                    'room_number': broadcast_data['room_number'],
                    'user_id': broadcast_data['student_id'],
                    'bed_id': broadcast_data['bed_id'],
                    'resource': 'room',
                })
                self._broadcast_event('room_updated', {'room_id': broadcast_data['room_id'], 'resource': 'room'})

            return Response(RoomSerializer(room).data, status=status.HTTP_200_OK)
        
        except Exception as e:
            # Catch any unexpected errors
            logger.error(f"Room allocation error: {e}", exc_info=True)
            return Response({
                'detail': 'An error occurred during allocation. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsStaff | IsChef])
    def deallocate(self, request, pk=None):
        """
        Deallocate a student from a room.
        
        FIX #3: Lock symmetry - uses same locking strategy as allocate.
        """
        from django.db import DatabaseError
        
        broadcast_data = None
        
        try:
            with transaction.atomic():
                # Lock room with nowait (same as allocate)
                try:
                    room = Room.objects.select_for_update(nowait=True).get(pk=pk)
                except DatabaseError:
                    return Response({
                        'detail': 'Room is currently being modified. Please try again.'
                    }, status=status.HTTP_409_CONFLICT)
                
                student_id = request.data.get('user_id') or request.data.get('student_id')

                if not student_id:
                    return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

                # Lock allocation with nowait (consistency with allocate)
                try:
                    allocation = RoomAllocation.objects.filter(
                        room=room,
                        student_id=student_id,
                        end_date__isnull=True
                    ).select_for_update(nowait=True).first()
                except DatabaseError:
                    return Response({
                        'detail': 'Allocation is being modified. Please try again.'
                    }, status=status.HTTP_409_CONFLICT)

                if not allocation:
                    return Response({'detail': 'Active allocation not found.'}, status=status.HTTP_404_NOT_FOUND)

                allocation.end_date = date.today()
                allocation.status = 'completed'
                allocation.save(update_fields=['end_date', 'status'])
                
                if allocation.bed:
                    allocation.bed.is_occupied = False
                    allocation.bed.save()

                room.current_occupancy = RoomAllocation.objects.filter(
                    room=room,
                    end_date__isnull=True,
                    status='approved',
                ).count()
                room.save(update_fields=['current_occupancy'])
                
                # Store for broadcasts after commit
                broadcast_data = {
                    'student_id': int(student_id),
                    'room_id': room.id,
                    'room_number': room.room_number,
                }
                
                # Transaction commits here
            
            # Broadcasts OUTSIDE transaction (same pattern as allocate)
            if broadcast_data:
                broadcast_to_updates_user(broadcast_data['student_id'], 'room_deallocated', {
                    'room_id': broadcast_data['room_id'],
                    'room_number': broadcast_data['room_number'],
                    'resource': 'room',
                })
                self._broadcast_event('room_deallocated', {
                    'room_id': broadcast_data['room_id'],
                    'room_number': broadcast_data['room_number'],
                    'user_id': broadcast_data['student_id'],
                    'resource': 'room',
                })
                self._broadcast_event('room_updated', {'room_id': broadcast_data['room_id'], 'resource': 'room'})

            return Response({'detail': 'Room deallocated successfully.'}, status=status.HTTP_200_OK)
        
        except Exception as e:
            logger.error(f"Room deallocation error: {e}", exc_info=True)
            return Response({
                'detail': 'An error occurred during deallocation. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class RoomAllocationViewSet(viewsets.ModelViewSet):
    """ViewSet for Room Allocation management."""
    queryset = RoomAllocation.objects.all()
    serializer_class = RoomAllocationSerializer
    permission_classes = [IsAuthenticated, IsStaff | IsChef]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'room', 'student']
    search_fields = ['student__username', 'room__room_number']
    ordering_fields = ['allocated_date', 'created_at']

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

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated, IsStaff | IsChef])
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

            # Real-time updates
            broadcast_to_updates_user(int(student_id), 'room_moved', {
                'user_id': int(student_id),
                'from_room_id': old_room.id,
                'to_room_id': target_room.id,
                'from_bed_id': old_bed.id if old_bed else None,
                'to_bed_id': target_bed.id,
                'resource': 'room',
            })
            for role in ['staff', 'admin', 'super_admin', 'warden', 'head_warden']:
                broadcast_to_role(role, 'room_moved', {
                    'user_id': int(student_id),
                    'from_room_id': old_room.id,
                    'to_room_id': target_room.id,
                    'from_bed_id': old_bed.id if old_bed else None,
                    'to_bed_id': target_bed.id,
                    'resource': 'room',
                })
                broadcast_to_role(role, 'room_updated', {'room_id': old_room.id, 'resource': 'room'})
                broadcast_to_role(role, 'room_updated', {'room_id': target_room.id, 'resource': 'room'})

            serializer = self.get_serializer(new_alloc)
            return Response(serializer.data, status=status.HTTP_200_OK)
