"""Onboarding views for bulk student/staff import."""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from core.permissions import IsAdmin
from apps.users.services import BulkImportService

class StudentImportViewSet(viewsets.ViewSet):
    """
    Onboarding API for Phase 7 launches.
    Allows admins to upload CSVs of students for rapid deployment.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    @action(detail=False, methods=['post'], url_path='csv')
    def upload_csv(self, request):
        """
        Endpoint: /api/users/import/csv/
        Body: multipart/form-data with 'file'
        """
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not csv_file.name.endswith('.csv'):
            return Response({'error': 'File must be a CSV'}, status=status.HTTP_400_BAD_REQUEST)
        
        college_id = request.user.college_id
        if not college_id:
            return Response({'error': 'User must belong to a college to import students'}, 
                            status=status.HTTP_400_BAD_REQUEST)

        result = BulkImportService.import_students_csv(
            college_id=college_id,
            csv_file=csv_file,
            requested_by=request.user
        )
        
        if 'error' in result:
            return Response(result, status=status.HTTP_403_FORBIDDEN)
            
        return Response(result, status=status.HTTP_201_CREATED)
