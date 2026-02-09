"""Users app serializers."""
from rest_framework import serializers
from apps.auth.serializers import UserSerializer
from apps.users.models import Tenant

class TenantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = Tenant
        fields = ['id', 'user', 'father_name', 'father_phone', 
                  'mother_name', 'mother_phone',
                  'guardian_name', 'guardian_phone',
                  'emergency_contact', 'address', 'city', 'state', 'pincode', 
                  'college_code', 'created_at']
