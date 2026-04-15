import sys
import re

file_path = "backend_django/apps/attendance/services.py"

with open(file_path, "r") as f:
    content = f.read()

# 1. Insert the helper method
helper_code = """
    @staticmethod
    def _check_attendance_time_lock(actor, building_id):
        if not building_id or user_is_top_level_management(actor):
            return None
        
        from apps.rooms.models import Building
        from datetime import datetime, timedelta
        from django.utils import timezone
        
        building = Building.objects.filter(id=building_id).first()
        if not building or not getattr(building, 'attendance_time', None):
            return None
            
        now = timezone.localtime()
        att_time = building.attendance_time
        
        att_dt = datetime.combine(now.date(), att_time)
        now_dt = datetime.combine(now.date(), now.time())
        diff_minutes = (now_dt - att_dt).total_seconds() / 60.0
        
        if diff_minutes < 0 or diff_minutes > 30:
            window_end = (att_dt + timedelta(minutes=30)).time()
            return f"Attendance window is closed. Available {att_time.strftime('%H:%M')} to {window_end.strftime('%H:%M')}."
        return None
"""

if "_check_attendance_time_lock" not in content:
    # insert before mark_attendance
    content = content.replace("    @staticmethod\n    def mark_attendance", helper_code + "\n    @staticmethod\n    def mark_attendance")

# 2. Insert call in mark_attendance
if "time_err = AttendanceService._check_attendance_time_lock(actor, building_id)" not in content:
    mark_att_hook = """        if not has_scope_access(actor, building_id=building_id, floor=floor) and not user_is_top_level_management(actor):
            return AttendanceMutationResult(
                status_code=status.HTTP_403_FORBIDDEN,
                payload={'detail': 'Insufficient authority to mark attendance for this student or area.'},
            )

        time_err = AttendanceService._check_attendance_time_lock(actor, building_id)
        if time_err:
            return AttendanceMutationResult(
                status_code=status.HTTP_403_FORBIDDEN,
                payload={'detail': time_err, 'code': 'ATTENDANCE_TIME_LOCKED'},
            )"""
    content = content.replace("        if not has_scope_access(actor, building_id=building_id, floor=floor) and not user_is_top_level_management(actor):\n            return AttendanceMutationResult(\n                status_code=status.HTTP_403_FORBIDDEN,\n                payload={'detail': 'Insufficient authority to mark attendance for this student or area.'},\n            )", mark_att_hook, 1)

# 3. Insert call in mark_all
if "time_err = AttendanceService._check_attendance_time_lock(actor, building_id)" not in mark_att_hook: # Wait I'm just appending to mark_all directly.
    mark_all_hook = """        if not has_scope_access(actor, building_id=building_id, floor=floor):
            return AttendanceMutationResult(
                status_code=status.HTTP_403_FORBIDDEN,
                payload={'detail': 'Not authorized to perform bulk actions in this scope.'},
            )
            
        time_err = AttendanceService._check_attendance_time_lock(actor, building_id)
        if time_err:
            return AttendanceMutationResult(
                status_code=status.HTTP_403_FORBIDDEN,
                payload={'detail': time_err, 'code': 'ATTENDANCE_TIME_LOCKED'},
            )"""
            
    content = content.replace("        if not has_scope_access(actor, building_id=building_id, floor=floor):\n            return AttendanceMutationResult(\n                status_code=status.HTTP_403_FORBIDDEN,\n                payload={'detail': 'Not authorized to perform bulk actions in this scope.'},\n            )", mark_all_hook, 1)

with open(file_path, "w") as f:
    f.write(content)
print("Patch applied.")
