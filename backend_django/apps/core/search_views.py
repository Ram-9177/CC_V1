"""Global search API views."""
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from apps.auth.models import User
from apps.gate_passes.models import GatePass
from apps.rooms.models import Room
from apps.complaints.models import Complaint

class GlobalSearchViewSet(viewsets.ViewSet):
    """Universal search across multiple system entities."""
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def search(self, request):
        """Perform global search across students, passes, rooms, and complaints."""
        query = request.query_params.get('q', '').strip()
        if not query or len(query) < 2:
            return Response({'results': []})

        results = []
        user = request.user
        
        # 1. Search Students (Full access for Staff)
        if user.role in ['admin', 'super_admin', 'warden', 'head_warden']:
            students = User.objects.filter(
                Q(registration_number__icontains=query) |
                Q(first_name__icontains=query) |
                Q(last_name__icontains=query) |
                Q(email__icontains=query),
                role='student'
            )[:5]
            for s in students:
                results.append({
                    'type': 'student',
                    'id': s.id,
                    'title': s.get_full_name() or s.username,
                    'subtitle': f"ID: {s.registration_number}",
                    'href': f"/profile/{s.id}"
                })

        # 2. Search Gate Passes (Staff or Own only)
        pass_qs = GatePass.objects.all()
        if user.role == 'student':
            pass_qs = pass_qs.filter(student=user)
        
        passes = pass_qs.filter(
            Q(destination__icontains=query) |
            Q(id__icontains=query) if query.isdigit() else Q()
        ).select_related('student')[:5]
        for p in passes:
            results.append({
                'type': 'gatepass',
                'id': p.id,
                'title': f"Pass #{p.id} - {p.get_pass_type_display()}",
                'subtitle': f"To {p.destination} ({p.student.username})",
                'href': f"/gate-passes"
            })

        # 3. Search Complaints
        complaint_qs = Complaint.objects.all()
        if user.role == 'student':
            complaint_qs = complaint_qs.filter(student=user)
            
        complaints = complaint_qs.filter(
            Q(title__icontains=query) |
            Q(description__icontains=query)
        )[:5]
        for c in complaints:
            results.append({
                'type': 'complaint',
                'id': c.id,
                'title': c.title,
                'subtitle': f"Status: {c.status}",
                'href': f"/complaints"
            })

        # 4. Search Rooms (Staff only)
        if user.role in ['admin', 'super_admin', 'warden', 'head_warden']:
            rooms = Room.objects.filter(
                room_number__icontains=query
            ).select_related('building')[:5]
            for r in rooms:
                results.append({
                    'type': 'room',
                    'id': r.id,
                    'title': f"Room {r.room_number}",
                    'subtitle': f"Building: {r.building.building_name}",
                    'href': f"/rooms"
                })

        return Response({'results': results})
