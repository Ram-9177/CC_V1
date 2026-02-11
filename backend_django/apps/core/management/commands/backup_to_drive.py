from django.core.management.base import BaseCommand
from django.conf import settings
from django.utils import timezone
import os
import io
import json
import gzip
from datetime import datetime
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload

class Command(BaseCommand):
    help = 'Backup database and upload to Google Drive'

    def add_arguments(self, parser):
        parser.add_argument(
            '--folder-id',
            type=str,
            help='Google Drive Folder ID to upload strict (overrides env var)'
        )
        parser.add_argument(
            '--keep-days',
            type=int,
            default=7,
            help='Number of days to keep backups'
        )

    def handle(self, *args, **options):
        self.stdout.write("Starting database backup...")

        # 1. Get Credentials
        creds_json = os.environ.get('GOOGLE_DRIVE_CREDENTIALS')
        folder_id = options['folder_id'] or os.environ.get('GOOGLE_BACKUP_FOLDER_ID')

        if not creds_json:
            self.stderr.write("Error: GOOGLE_DRIVE_CREDENTIALS env var not found.")
            return
        
        if not folder_id:
            self.stderr.write("Error: GOOGLE_BACKUP_FOLDER_ID env var not found.")
            return

        try:
            creds_dict = json.loads(creds_json)
            credentials = service_account.Credentials.from_service_account_info(creds_dict)
            service = build('drive', 'v3', credentials=credentials)
        except Exception as e:
            self.stderr.write(f"Auth Error: {str(e)}")
            return

        # 2. Dump Database (using dumping to memory buffer then gzip)
        # Using pure Python dumpdata for portability on free-tier
        self.stdout.write("Dumping database to JSON...")
        from django.core.management import call_command
        
        timestamp = datetime.now().strftime('%Y-%m-%d_%H%M%S')
        filename = f"backup_{timestamp}.json.gz"
        
        # Buffer for the JSON data
        json_buffer = io.StringIO()
        # Exclude sessions, admin logs, contenttypes to save space
        call_command('dumpdata', exclude=['sessions', 'admin', 'contenttypes', 'auth.permission'], stdout=json_buffer)
        
        # Buffer for the GZIP data
        gzip_buffer = io.BytesIO()
        with gzip.GzipFile(fileobj=gzip_buffer, mode='wb') as gz:
            gz.write(json_buffer.getvalue().encode('utf-8'))
        
        gzip_buffer.seek(0)
        file_size_mb = len(gzip_buffer.getvalue()) / (1024 * 1024)
        self.stdout.write(f"Backup size: {file_size_mb:.2f} MB")

        # 3. Upload to Drive
        self.stdout.write(f"Uploading {filename} to Google Drive...")
        
        file_metadata = {
            'name': filename,
            'parents': [folder_id]
        }
        
        media = MediaIoBaseUpload(
            gzip_buffer,
            mimetype='application/gzip',
            resumable=True
        )
        
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        self.stdout.write(self.style.SUCCESS(f"Successfully uploaded: {file.get('id')}"))

        # 4. Cleanup Old Backups
        keep_days = options['keep_days']
        self.stdout.write(f"Cleaning up backups older than {keep_days} days...")
        
        query = f"'{folder_id}' in parents and trashed = false and name contains 'backup_'"
        results = service.files().list(
            q=query,
            fields="nextPageToken, files(id, name, createdTime)",
            orderBy="createdTime desc"
        ).execute()
        
        files = results.get('files', [])
        
        # Keep only the last 'keep_days' files based on count, 
        # or parse date if needed. Simpler logic: Keep N most recent.
        # Ideally, parse date from filename or createdTime.
        
        from datetime import timedelta
        cutoff_date = timezone.now() - timedelta(days=keep_days)
        
        for f in files:
            # Parse createdTime: 2023-10-27T10:00:00.000Z
            try:
                created_time_str = f['createdTime'].replace('Z', '+00:00')
                created_time = datetime.fromisoformat(created_time_str)
                
                if created_time < cutoff_date:
                    self.stdout.write(f"Deleting old backup: {f['name']} ({f['createdTime']})")
                    service.files().delete(fileId=f['id']).execute()
            except Exception as e:
                self.stdout.write(f"Skipping cleanup for {f['name']}: {str(e)}")

        self.stdout.write(self.style.SUCCESS('Backup process completed.'))
