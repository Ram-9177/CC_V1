"""Rooms app views."""
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.db import transaction
from datetime import date
from django.db import models
from apps.rooms.models import Room, RoomAllocation
from apps.rooms.serializers import RoomSerializer, RoomAllocationSerializer
from apps.auth.models import User
from core.permissions import IsAdmin, IsWarden, user_is_admin, user_is_staff

class RoomViewSet(viewsets.ModelViewSet):
    """ViewSet for Room management."""
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['floor', 'room_type', 'is_available']
    search_fields = ['room_number', 'description']
    ordering_fields = ['floor', 'room_number', 'rent']
    
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

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdmin | IsWarden])
    def allocate(self, request, pk=None):
        """Allocate a room to a student."""
        with transaction.atomic():
            room = Room.objects.select_for_update().get(pk=pk)
        student_id = request.data.get('user_id') or request.data.get('student_id')

        if not student_id:
            return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student = User.objects.get(id=student_id)
        except User.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=status.HTTP_404_NOT_FOUND)

        if room.current_occupancy >= room.capacity:
            return Response({'detail': 'Room is full.'}, status=status.HTTP_400_BAD_REQUEST)

        existing = RoomAllocation.objects.filter(room=room, student=student, end_date__isnull=True).first()
        if existing:
            return Response({'detail': 'Student already allocated to this room.'}, status=status.HTTP_400_BAD_REQUEST)

            allocation = RoomAllocation.objects.create(
                room=room,
                student=student,
                status='approved',
                allocated_date=date.today(),
            )

            room.current_occupancy = min(room.capacity, room.current_occupancy + 1)
            room.is_available = room.current_occupancy < room.capacity
            room.save(update_fields=['current_occupancy', 'is_available'])

            return Response(RoomSerializer(room).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated, IsAdmin | IsWarden])
    def deallocate(self, request, pk=None):
        """Deallocate a student from a room."""
        with transaction.atomic():
            room = Room.objects.select_for_update().get(pk=pk)
            student_id = request.data.get('user_id') or request.data.get('student_id')

        if not student_id:
            return Response({'detail': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

            allocation = RoomAllocation.objects.filter(
                room=room,
                student_id=student_id,
                end_date__isnull=True
            ).first()

            if not allocation:
                return Response({'detail': 'Active allocation not found.'}, status=status.HTTP_404_NOT_FOUND)

            allocation.end_date = date.today()
            allocation.status = 'completed'
            allocation.save(update_fields=['end_date', 'status'])

            room.current_occupancy = max(0, room.current_occupancy - 1)
            room.is_available = room.current_occupancy < room.capacity
            room.save(update_fields=['current_occupancy', 'is_available'])

            return Response(RoomSerializer(room).data, status=status.HTTP_200_OK)


class RoomAllocationViewSet(viewsets.ModelViewSet):
    """ViewSet for Room Allocation management."""
    queryset = RoomAllocation.objects.all()
    serializer_class = RoomAllocationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['status', 'room', 'student']
    search_fields = ['student__username', 'room__room_number']
    ordering_fields = ['allocated_date', 'created_at']
