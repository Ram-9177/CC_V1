"""Super Admin app views for granular access control."""
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsSuperAdmin
from apps.colleges.models import College
from apps.rooms.models import Hostel, Building
from apps.rooms.views import invalidate_hostel_map_cache, broadcast_room_event
from core.audit import log_action

class ToggleCollegeView(APIView):
    """View to toggle a college's active status."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    
    def post(self, request):
        college_id = request.data.get('id')
        reason = request.data.get('reason', '')
        
        if not college_id:
            return Response({'detail': 'College ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            college = College.objects.get(id=college_id)
        except College.DoesNotExist:
            return Response({'detail': 'College not found.'}, status=status.HTTP_404_NOT_FOUND)
        
        old_status = college.is_active
        college.is_active = not college.is_active
        college.disabled_reason = reason if not college.is_active else ''
        college.save(update_fields=['is_active', 'disabled_reason', 'updated_at'])
        
        status_text = 'enabled' if college.is_active else 'disabled'
        log_action(request.user, 'UPDATE', college, changes={'is_active': [old_status, college.is_active], 'reason': reason}, request=request)
        
        return Response({
            'detail': f'College "{college.name}" has been {status_text}.',
            'is_active': college.is_active
        })

class ToggleHostelView(APIView):
    """View to toggle a hostel's active status."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    
    def post(self, request):
        hostel_id = request.data.get('id')
        reason = request.data.get('reason', '')
        
        if not hostel_id:
            return Response({'detail': 'Hostel ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            hostel = Hostel.objects.get(id=hostel_id)
        except Hostel.DoesNotExist:
            return Response({'detail': 'Hostel not found.'}, status=status.HTTP_404_NOT_FOUND)
            
        old_status = hostel.is_active
        hostel.is_active = not hostel.is_active
        hostel.disabled_reason = reason if not hostel.is_active else ''
        hostel.save(update_fields=['is_active', 'disabled_reason', 'updated_at'])
        
        invalidate_hostel_map_cache()
        broadcast_room_event('room_updated', {'resource': 'hostel', 'hostel_id': hostel.id})
        
        return Response({
            'detail': f'Hostel "{hostel.name}" has been {"enabled" if hostel.is_active else "disabled"}.',
            'is_active': hostel.is_active
        })

class ToggleBlockView(APIView):
    """View to toggle a block\'s active status."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    
    def post(self, request):
        block_id = request.data.get('id')
        reason = request.data.get('reason', '')
        
        if not block_id:
            return Response({'detail': 'Block ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            block = Building.objects.get(id=block_id)
        except Building.DoesNotExist:
            return Response({'detail': 'Block not found.'}, status=status.HTTP_404_NOT_FOUND)
            
        old_status = block.is_active
        block.is_active = not block.is_active
        block.disabled_reason = reason if not block.is_active else ''
        block.save(update_fields=['is_active', 'disabled_reason', 'updated_at'])
        
        invalidate_hostel_map_cache()
        broadcast_room_event('room_updated', {'resource': 'building', 'building_id': block.id})
        
        return Response({
            'detail': f'Block "{block.name}" has been {"enabled" if block.is_active else "disabled"}.',
            'is_active': block.is_active
        })

class ToggleFloorView(APIView):
    """View to toggle a specific floor\'s active status."""
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    
    def post(self, request):
        block_id = request.data.get('block_id')
        floor_num = request.data.get('floor')
        
        if not block_id or floor_num is None:
            return Response({'detail': 'block_id and floor are required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            block = Building.objects.get(id=block_id)
        except Building.DoesNotExist:
            return Response({'detail': 'Block not found.'}, status=status.HTTP_404_NOT_FOUND)
            
        floor_num = int(floor_num)
        disabled_floors = list(block.disabled_floors or [])
        
        if floor_num in disabled_floors:
            disabled_floors.remove(floor_num)
            action_done = 'enabled'
        else:
            disabled_floors.append(floor_num)
            action_done = 'disabled'
            
        block.disabled_floors = disabled_floors
        block.save(update_fields=['disabled_floors', 'updated_at'])
        
        invalidate_hostel_map_cache()
        broadcast_room_event('room_updated', {
            'resource': 'floor', 
            'building_id': block.id, 
            'floor_num': floor_num,
            'status': action_done
        })
        
        return Response({
            'detail': f'Floor {floor_num} in "{block.name}" has been {action_done}.',
            'disabled_floors': block.disabled_floors
        })
