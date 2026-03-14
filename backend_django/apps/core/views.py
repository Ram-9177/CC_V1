from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from django.http import HttpResponse, StreamingHttpResponse
from django.core.management import call_command
from django.core.cache import cache
from django.utils import timezone
import os
import gzip
import tempfile
import io
from core.permissions import IsTopLevel


SYSTEM_SETTINGS_CACHE_KEY = 'core:system_settings:v1'
DEFAULT_SYSTEM_SETTINGS = {
    'maintenance_mode': False,
    'maintenance_message': '',
    'allow_registrations': True,
    'allow_password_reset': True,
}

class GzipStreamWrapper:
    """Wraps a binary stream (GzipFile) to accept text input (for dumpdata)."""
    def __init__(self, binary_stream):
        self.stream = binary_stream

    def write(self, s):
        self.stream.write(s.encode('utf-8'))

    def flush(self):
        self.stream.flush()

class DownloadBackupView(APIView):
    """
    Endpoint for admins to download a database backup.
    URL: /api/core/backup/download/
    """
    permission_classes = [IsAdminUser]

    def get(self, request):
        timestamp = timezone.now().strftime('%Y-%m-%d_%H%M%S')
        filename = f"hostel_backup_{timestamp}.json.gz"
        
        # Create a temporary file to store the compressed dump
        # We use a temp file because streaming directly from dumpdata -> gzip -> response is complex 
        # and prone to buffering issues with Django's WSGI handler on some servers.
        # Temp file is safer for memory (512MB limit) as data is written to disk.
        
        fd, temp_path = tempfile.mkstemp(suffix='.json.gz')
        os.close(fd)
        
        try:
            with gzip.open(temp_path, 'wb') as gz_file:
                # Wrap the gzip file object to accept strings (which dumpdata outputs)
                text_wrapper = GzipStreamWrapper(gz_file)
                
                # Run dumpdata, excluding heavy/unnecessary tables
                call_command(
                    'dumpdata', 
                    exclude=['sessions', 'admin', 'contenttypes', 'auth.permission'], 
                    stdout=text_wrapper
                )
            
            # File iterator that cleans up after itself
            def file_cleanup_iterator(file_path):
                try:
                    with open(file_path, 'rb') as f:
                        yield from f
                finally:
                    if os.path.exists(file_path):
                        os.remove(file_path)
            
            response = StreamingHttpResponse(
                file_cleanup_iterator(temp_path),
                content_type='application/gzip'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
            
        except Exception as e:
            # If something fails, try to cleanup
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return HttpResponse(f"Error creating backup: {str(e)}", status=500)


class SystemSettingsView(APIView):
    """Basic system settings endpoint used by frontend admin hooks."""

    permission_classes = [IsTopLevel]

    def get(self, request):
        settings_payload = cache.get(SYSTEM_SETTINGS_CACHE_KEY, DEFAULT_SYSTEM_SETTINGS.copy())
        return Response(settings_payload)

    def put(self, request):
        if not isinstance(request.data, dict):
            return Response({'detail': 'Invalid payload. Expected an object.'}, status=status.HTTP_400_BAD_REQUEST)

        current_settings = cache.get(SYSTEM_SETTINGS_CACHE_KEY, DEFAULT_SYSTEM_SETTINGS.copy())
        updated_settings = {**current_settings, **request.data}
        cache.set(SYSTEM_SETTINGS_CACHE_KEY, updated_settings, timeout=None)
        return Response(updated_settings)
