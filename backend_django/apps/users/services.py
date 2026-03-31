"""Users app services for bulk operations."""
import csv
import io
import logging
from django.db import transaction
from django.contrib.auth.hashers import make_password
from apps.auth.models import User
from apps.colleges.models import College

logger = logging.getLogger(__name__)

class BulkImportService:
    """Service to handle high-volume student and staff onboarding."""
    
    @staticmethod
    def import_students_csv(college_id: int, csv_file, requested_by):
        """
        Process a CSV of students and create user accounts.
        Expects: registration_number, first_name, last_name, email, phone, department
        """
        college = College.objects.get(id=college_id)
        
        # Check user limit
        if college.is_at_user_limit():
            return {"error": "College has reached its user limit. Upgrade plan to add more."}

        file = csv_file.read().decode('utf-8')
        reader = csv.DictReader(io.StringIO(file))
        
        created_count = 0
        skipped_count = 0
        errors = []

        with transaction.atomic():
            for row in reader:
                reg_no = row.get('registration_number', '').strip().upper()
                if not reg_no:
                    skipped_count += 1
                    continue
                
                # Check if user already exists
                if User.objects.filter(username=reg_no).exists() or User.objects.filter(registration_number=reg_no).exists():
                    skipped_count += 1
                    continue
                
                try:
                    # Default password is reg_no in lowercase (initial setup)
                    default_password = reg_no.lower()
                    
                    user = User.objects.create(
                        username=reg_no,
                        registration_number=reg_no,
                        first_name=row.get('first_name', ''),
                        last_name=row.get('last_name', ''),
                        email=row.get('email', f"{reg_no}@temporary.edu"),
                        phone_number=row.get('phone', ''),
                        department=row.get('department', ''),
                        role='student',
                        college=college,
                        is_password_changed=False # Force change on first login
                    )
                    user.set_password(default_password)
                    user.save()
                    created_count += 1
                except Exception as e:
                    errors.append(f"Error creating {reg_no}: {str(e)}")
                    continue
        
        return {
            "created": created_count,
            "skipped": skipped_count,
            "errors": errors[:10] # Return first 10 errors for debugging
        }
