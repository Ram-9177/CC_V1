from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from uuid import UUID
from apps.auth.models import User
from apps.rooms.models import Room
from apps.gate_passes.models import GatePass
from apps.complaints.models import Complaint
from core.constants import ROLE_SUPER_ADMIN
from core.rbac import is_top_level_management, is_warden


def _parse_uuid_or_none(value: str):
    try:
        return UUID(value)
    except Exception:
        return None

class GlobalSearchView(APIView):
    """
    God Level Unified Search API.
    Returns categorized results for the Command Palette.
    Optimized for SQLite with limit-per-category.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if len(query) < 2:
            return Response({'results': []})

        user = request.user
        college = getattr(user, 'college', None)
        is_admin = is_top_level_management(user.role)
        is_staff = is_warden(user.role)
        query_uuid = _parse_uuid_or_none(query)

        results = []

        # 1. Search Users (Students/Staff)
        user_qs = User.objects.filter(
            Q(first_name__icontains=query) |
            Q(last_name__icontains=query) |
            Q(username__icontains=query) |
            Q(registration_number__icontains=query)
        ).only('id', 'first_name', 'last_name', 'username', 'registration_number', 'role', 'college_id')
        if college and user.role != ROLE_SUPER_ADMIN:
            user_qs = user_qs.filter(college=college)
        # Students must never receive discoverability of peer students.
        # Allow self + non-student operational contacts only.
        if user.role == 'student':
            user_qs = user_qs.filter(Q(id=user.id) | ~Q(role='student'))
        
        for u in user_qs[:5]:
            display_name = (u.get_full_name() or '').strip() or u.username
            results.append({
                'id': u.id,
                'category': 'Users',
                'title': display_name,
                'subtitle': f"{u.role.upper()} | {u.registration_number or u.username}",
                'url': f"/profile/{u.id}" if is_admin else None,
                'icon': 'user'
            })

        # 2. Search Rooms
        room_qs = Room.objects.filter(room_number__icontains=query)
        if college and user.role != ROLE_SUPER_ADMIN:
            room_qs = room_qs.filter(college=college)
        
        for r in room_qs[:5]:
            results.append({
                'id': r.id,
                'category': 'Rooms',
                'title': f"Room {r.room_number}",
                'subtitle': f"{r.room_type} | {r.current_occupancy}/{r.capacity} Occupied",
                'url': f"/rooms?search={r.room_number}" if is_staff else None,
                'icon': 'door'
            })

        # 3. Search Gate Passes (By ID or Student Name)
        gp_filter = (
            Q(destination__icontains=query)
            | Q(student__first_name__icontains=query)
            | Q(student__last_name__icontains=query)
            | Q(student__registration_number__icontains=query)
        )
        if query_uuid is not None:
            gp_filter |= Q(id=query_uuid)

        gp_qs = GatePass.objects.filter(gp_filter).select_related('student').only(
            'id', 'status', 'destination', 'student__first_name', 'student__last_name', 'student__username', 'college_id'
        )
        if college and user.role != ROLE_SUPER_ADMIN:
            gp_qs = gp_qs.filter(college=college)
        elif not is_staff and not is_admin:
            gp_qs = gp_qs.filter(student=user)
            
        for gp in gp_qs[:5]:
            student_name = (gp.student.get_full_name() or '').strip() or gp.student.username
            results.append({
                'id': gp.id,
                'category': 'Gate Passes',
                'title': f"Pass #{gp.id}",
                'subtitle': f"{student_name} | {gp.status.upper()}",
                'url': f"/gate-passes?id={gp.id}",
                'icon': 'pass'
            })

        # 4. Search Complaints
        comp_filter = Q(title__icontains=query) | Q(description__icontains=query)
        if query_uuid is not None:
            comp_filter |= Q(id=query_uuid)

        comp_qs = Complaint.objects.filter(comp_filter).only('id', 'title', 'status', 'student_id', 'college_id')
        if college and user.role != ROLE_SUPER_ADMIN:
            comp_qs = comp_qs.filter(college=college)
        elif not is_staff and not is_admin:
            comp_qs = comp_qs.filter(student=user)

        for c in comp_qs[:5]:
            results.append({
                'id': c.id,
                'category': 'Complaints',
                'title': f"Complaint #{c.id}",
                'subtitle': f"{c.title} | {c.status.upper()}",
                'url': f"/complaints?id={c.id}",
                'icon': 'alert'
            })

        return Response({'results': results})
