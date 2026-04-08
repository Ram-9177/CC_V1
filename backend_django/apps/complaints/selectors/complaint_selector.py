from apps.complaints.models import Complaint

def get_complaint_by_id(complaint_id):
    """Fetch complaint instance reliably."""
    return Complaint.objects.filter(id=complaint_id).first()

def get_pending_complaints_for_student(student_id):
    """Ensure student isn't spamming."""
    return Complaint.objects.filter(student_id=student_id, status='pending').count()
