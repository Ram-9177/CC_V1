"""Users app serializers."""
from rest_framework import serializers
from apps.auth.serializers import UserSerializer
from apps.users.models import Tenant

class TenantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Tenant
        fields = ['id', 'user', 'guardian_name', 'guardian_phone', 'emergency_contact', 
                  'address', 'city', 'state', 'pincode', 'created_at']
