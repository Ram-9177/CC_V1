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
                  'college_code', 'is_allocated', 'room_number', 'created_at']

    def get_is_allocated(self, obj):
        active_alloc = obj.user.room_allocations.filter(status='approved', end_date__isnull=True).exists()
        return active_alloc

    def get_room_number(self, obj):
        active_alloc = obj.user.room_allocations.filter(status='approved', end_date__isnull=True).select_related('room').first()
        return active_alloc.room.room_number if active_alloc else None
