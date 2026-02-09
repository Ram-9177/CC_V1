"""Users app views."""
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsStaff
from apps.users.models import Tenant
from apps.users.serializers import TenantSerializer

from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from django.db import transaction
from apps.auth.models import User
import csv
import io

from rest_framework import filters

class TenantViewSet(viewsets.ModelViewSet):
    # Optimize query with select_related to prevent N+1
    queryset = Tenant.objects.select_related('user').all().order_by('-created_at')
    serializer_class = TenantSerializer
    permission_classes = [IsAuthenticated, IsStaff]
    
    filter_backends = [filters.SearchFilter]
    search_fields = [
        'user__username', 
        'user__first_name', 
        'user__last_name', 
        'user__registration_number',
        'city',
        'college_code'
    ]
    
    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser])
    def bulk_upload(self, request):
        """Upload students via CSV."""
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            decoded_file = file_obj.read().decode('utf-8')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)
            
            created_count = 0
            errors = []
            
            with transaction.atomic():
                for row in reader:
                    reg_no = (
                        row.get('registration_number')
                        or row.get('reg_no')
                        or row.get('hall_ticket')
                        or row.get('username')
                    )
                    reg_no = (reg_no or '').strip().upper()
                    if not reg_no:
                        continue
                        
                    # Check if user exists
                    if User.objects.filter(username__iexact=reg_no).exists():
                        errors.append(f"User {reg_no} already exists")
                        continue
                    
                    try:
                        user = User.objects.create_user(
                            username=reg_no,
                            email=row.get('email', ''),
                            first_name=row.get('first_name', ''),
                            last_name=row.get('last_name', ''),
                            password='password123',  # Default password
                            role='student',
                            registration_number=reg_no,
                            phone_number=row.get('phone_number', '')
                        )
                        
                        father_name = row.get('father_name') or row.get('parent_name') or row.get('guardian_name') or ''
                        father_phone = row.get('father_phone') or row.get('parent_phone') or row.get('guardian_phone') or ''
                        mother_name = row.get('mother_name') or ''
                        mother_phone = row.get('mother_phone') or ''
                        guardian_name = row.get('guardian_name') or ''
                        guardian_phone = row.get('guardian_phone') or ''

                        Tenant.objects.create(
                            user=user,
                            father_name=father_name,
                            father_phone=father_phone,
                            mother_name=mother_name,
                            mother_phone=mother_phone,
                            guardian_name=guardian_name,
                            guardian_phone=guardian_phone,
                            emergency_contact=row.get('emergency_contact', ''),
                            address=row.get('address', ''),
                            city=row.get('city', ''),
                            state=row.get('state', ''),
                            pincode=row.get('pincode', ''),
                            college_code=row.get('college_code', '') or None,
                        )
                        created_count += 1
                        
                    except Exception as e:
                        errors.append(f"Error creating {reg_no}: {str(e)}")
            
            return Response({
                'message': f'Successfully created {created_count} students.',
                'errors': errors
            })
            
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
