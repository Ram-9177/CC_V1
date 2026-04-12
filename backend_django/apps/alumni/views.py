"""Alumni app views — Phase 8."""

from rest_framework import viewsets, permissions, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
from django.db.models import Count, Q
from django.db import transaction

from core.college_mixin import CollegeScopeMixin
from core.event_service import EventService
from core.events import AppEvents
from .models import AlumniProfile, Mentorship
from .serializers import AlumniProfileSerializer, MentorshipSerializer
from apps.auth.models import User
from apps.placements.serializers import JobPostingSerializer

class AlumniProfileViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Network management for former students."""
    
    queryset = AlumniProfile.objects.all()
    serializer_class = AlumniProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def convert_to_alumni(self, request):
        """Graduation Engine: Transitions student identity to alumni."""
        if not request.user.role in ['admin', 'super_admin']:
             raise PermissionDenied("Only admin can trigger graduation.")

        student_id = request.data.get('student_id')
        graduation_year = request.data.get('graduation_year')
        
        if not student_id or not graduation_year:
             raise ValidationError("Please provide student_id and graduation_year.")

        try:
            student = User.objects.get(id=student_id)
        except User.DoesNotExist:
             raise ValidationError("Student not found.")

        if student.role == 'alumni':
             raise ValidationError("Account is already in Alumni status.")

        with transaction.atomic():
            # Update User Role
            student.role = 'alumni'
            student.save()
            
            # Create/Update Alumni Profile
            profile, created = AlumniProfile.objects.get_or_create(
                user=student,
                defaults={
                    'graduation_year': graduation_year,
                    'department': student.department or 'N/A'
                }
            )
            
            EventService.emit(AppEvents.ALUMNI_CREATED, student, {"profile_id": profile.id})

        return Response({"status": f"Student {student.username} has officially graduated to Alumni."}, status=http_status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def post_job(self, request):
        """Alumni contribution: Posting jobs for juniors."""
        if request.user.role != 'alumni':
             raise PermissionDenied("Only alumni can contribute jobs through this channel.")

        serializer = JobPostingSerializer(data=request.data)
        if serializer.is_valid():
             # Job is created in 'pending_approval' status for Alumni
             job = serializer.save(
                 status='pending_approval',
                 is_alumni_contribution=True,
                 alumni_contributor=request.user
             )
             EventService.emit(AppEvents.ALUMNI_JOB_POSTED, request.user, {"job_id": job.id})
             return Response(serializer.data, status=http_status.HTTP_201_CREATED)
        return Response(serializer.errors, status=http_status.HTTP_400_BAD_REQUEST)

class MentorshipViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Professional network connection flow."""
    
    queryset = Mentorship.objects.all()
    serializer_class = MentorshipSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['post'])
    def request_mentorship(self, request):
        """Student requesting guidance from alumni."""
        mentor_id = request.data.get('mentor_id')
        topic = request.data.get('topic')

        if request.user.role != 'student':
             raise PermissionDenied("Only active students can request mentorship.")

        try:
            mentor = User.objects.get(id=mentor_id, role='alumni')
        except User.DoesNotExist:
             raise ValidationError("Target alumni mentor not found.")

        if Mentorship.objects.filter(mentor=mentor, student=request.user, status__in=['requested', 'accepted']).exists():
             raise ValidationError("Active mentorship request already exists.")

        mentorship = Mentorship.objects.create(
            mentor=mentor,
            student=request.user,
            topic=topic,
            status='requested'
        )
        
        EventService.emit(AppEvents.MENTORSHIP_REQUESTED, mentor, {"student_id": request.user.id})
        return Response(MentorshipSerializer(mentorship).data, status=http_status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def respond_to_request(self, request, pk=None):
        """Alumni managing their network requests."""
        mentorship = self.get_object()
        if mentorship.mentor != request.user:
             raise PermissionDenied("Unauthorized response.")

        response_status = request.data.get('status')
        if response_status not in ['accepted', 'rejected']:
             raise ValidationError("Invalid status response.")

        mentorship.status = response_status
        mentorship.save()

        if response_status == 'accepted':
             EventService.emit(AppEvents.MENTORSHIP_ACCEPTED, mentorship.student, {"mentor_name": request.user.username})
             
        return Response({"status": f"Mentorship request {response_status}"})
