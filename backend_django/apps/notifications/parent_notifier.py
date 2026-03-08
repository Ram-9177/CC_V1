import logging
from apps.users.models import Tenant

logger = logging.getLogger(__name__)

def notify_parent_gate_pass_approved(gate_pass):
    """Fallback hook for parent notification on gate pass approval."""
    try:
        tenant = Tenant.objects.filter(user=gate_pass.student).first()
        if not tenant or not tenant.father_phone:
            return
        
        message = f"SMS to {tenant.father_phone}: Your ward {gate_pass.student.get_full_name()}'s gate pass ({gate_pass.pass_type}) is approved for {gate_pass.exit_date.strftime('%d-%m %H:%M')}. Destination: {gate_pass.destination}."
        logger.info(f"PARENT_NOTIF: {message}")
        # In production, integrate with SMS gateway (Twilio/AWS SNS) here
    except Exception as e:
        logger.error(f"Parent notification failed: {e}")

def notify_parent_leave_approved(leave):
    """Fallback hook for parent notification on leave approval."""
    try:
        tenant = Tenant.objects.filter(user=leave.student).first()
        if not tenant or not tenant.father_phone:
            return
        
        message = f"SMS to {tenant.father_phone}: Your ward {leave.student.get_full_name()}'s leave application from {leave.start_date.strftime('%d-%m')} to {leave.end_date.strftime('%d-%m')} is approved."
        logger.info(f"PARENT_NOTIF: {message}")
    except Exception as e:
        logger.error(f"Parent notification failed: {e}")

def notify_parent_gate_pass_rejected(gate_pass):
    """Fallback hook for parent notification on gate pass rejection."""
    try:
        tenant = Tenant.objects.filter(user=gate_pass.student).first()
        if not tenant or not tenant.father_phone:
            return
        
        reason = getattr(gate_pass, 'approval_remarks', 'Policy mismatch')
        message = f"SMS to {tenant.father_phone}: Your ward {gate_pass.student.get_full_name()}'s gate pass request to {gate_pass.destination} has been REJECTED. Reason: {reason}."
        logger.info(f"PARENT_NOTIF: {message}")
    except Exception as e:
        logger.error(f"Parent notification failed: {e}")

def notify_parent_leave_rejected(leave):
    """Fallback hook for parent notification on leave rejection."""
    try:
        tenant = Tenant.objects.filter(user=leave.student).first()
        if not tenant or not tenant.father_phone:
            return
        
        reason = getattr(leave, 'rejection_reason', 'Academic conflict')
        message = f"SMS to {tenant.father_phone}: Your ward {leave.student.get_full_name()}'s leave request ({leave.start_date.strftime('%d-%m')} to {leave.end_date.strftime('%d-%m')}) has been REJECTED. Reason: {reason}."
        logger.info(f"PARENT_NOTIF: {message}")
    except Exception as e:
        logger.error(f"Parent notification failed: {e}")
