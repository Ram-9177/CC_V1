"""Users app serializers."""
from rest_framework import serializers
from apps.auth.serializers import UserSerializer
from apps.users.models import Tenant

class TenantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    is_allocated = serializers.SerializerMethodField()
    room_number = serializers.SerializerMethodField()
    
    class Meta:
        model = Tenant
        fields = ['id', 'user', 'father_name', 'father_phone', 
                  'mother_name', 'mother_phone',
                  'guardian_name', 'guardian_phone',
                  'emergency_contact', 'address', 'city', 'state', 'pincode', 
                  'college_code', 'is_allocated', 'room_number', 'created_at',
                  'parent_informed']

    def get_is_allocated(self, obj):
        # Use prefetched active_allocations if available (from TenantViewSet)
        if hasattr(obj.user, 'active_allocations'):
            return len(obj.user.active_allocations) > 0
        return obj.user.room_allocations.filter(status='approved', end_date__isnull=True).exists()

    def get_room_number(self, obj):
        # Use prefetched active_allocations if available
        if hasattr(obj.user, 'active_allocations'):
            alloc = obj.user.active_allocations[0] if obj.user.active_allocations else None
            return alloc.room.room_number if alloc else None
        
        active_alloc = obj.user.room_allocations.filter(status='approved', end_date__isnull=True).select_related('room').first()
        return active_alloc.room.room_number if active_alloc else None

    def validate_college_code(self, value):
        """Ensure college code exists in the system."""
        if not value:
            return value
        from apps.colleges.models import College
        if not College.objects.filter(code=value).exists():
            raise serializers.ValidationError('Invalid college selection.')
        return value
