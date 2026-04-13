"""Placements app views — Phase 7."""

from rest_framework import viewsets, permissions, status as http_status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied
from django.utils import timezone
from django.db.models import Count, Q, Avg, Sum
from django.db import transaction

from core.college_mixin import CollegeScopeMixin
from core.event_service import EventService
from core.events import AppEvents
from .models import Company, JobPosting, Application, Offer
from .serializers import CompanySerializer, JobPostingSerializer, ApplicationSerializer, OfferSerializer

class CompanyViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Company management ViewSet."""
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(college=self.request.user.college)

class JobPostingViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Job lifecycle management."""
    queryset = JobPosting.objects.all()
    serializer_class = JobPostingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        job = serializer.save(created_by=self.request.user)
        EventService.emit(AppEvents.JOB_CREATED, self.request.user, {"job_id": job.id, "title": job.title})

    @action(detail=True, methods=['post'])
    def apply(self, request, pk=None):
        """Student application with eligibility check."""
        job = self.get_object()
        user = request.user
        
        # 1. Ownership / Student check
        if user.role != 'student':
             raise PermissionDenied("Only students can apply for jobs.")

        # 2. Deadline Check
        if job.application_deadline < timezone.now():
             raise ValidationError("Application deadline has passed.")

        # 3. Duplicate Application Check
        if Application.objects.filter(student=user, job=job).exists():
             raise ValidationError("You have already applied for this position.")

        # 4. Eligibility Engine
        # Retrieve tenant info for CGPA & Dept
        try:
            profile = user.tenant
        except:
            raise ValidationError("Student profile (Tenant) missing. Complete profile first.")

        eligible_depts = job.eligibility_criteria.get('allowed_departments', [])
        
        # CGPA Validation
        if profile.cgpa < job.min_cgpa:
            raise ValidationError(f"Ineligible: Minimum CGPA required is {job.min_cgpa}. Your CGPA: {profile.cgpa}")

        # Department Validation
        if eligible_depts and profile.department not in eligible_depts:
            raise ValidationError(f"Ineligible: This job is only for departments: {', '.join(eligible_depts)}")

        # 10th Standard Validation
        min_10th = job.eligibility_criteria.get('min_tenth_percentage')
        if min_10th and profile.tenth_percentage < min_10th:
            raise ValidationError(f"Ineligible: Minimum 10th percentage required is {min_10th}%. Your percentage: {profile.tenth_percentage}%")

        # 12th Standard Validation
        min_12th = job.eligibility_criteria.get('min_twelfth_percentage')
        if min_12th and profile.twelfth_percentage < min_12th:
            raise ValidationError(f"Ineligible: Minimum 12th percentage required is {min_12th}%. Your percentage: {profile.twelfth_percentage}%")

        # 12th PCM Validation
        min_pcm = job.eligibility_criteria.get('min_twelfth_pcm_percentage')
        if min_pcm and profile.twelfth_pcm_percentage < min_pcm:
            raise ValidationError(f"Ineligible: Minimum 12th PCM percentage required is {min_pcm}%. Your PCM percentage: {profile.twelfth_pcm_percentage}%")

        # Stream Validation
        required_stream = job.eligibility_criteria.get('required_stream')
        if required_stream:
            # Check for multiple allowed streams if it's a list, otherwise single string
            allowed_streams = [s.strip().upper() for s in (required_stream if isinstance(required_stream, list) else [required_stream])]
            if profile.plus_two_stream.upper() not in allowed_streams:
                raise ValidationError(f"Ineligible: Required stream(s): {', '.join(allowed_streams)}. Your stream: {profile.plus_two_stream}")

        with transaction.atomic():
            application = Application.objects.create(
                student=user,
                job=job,
                status='applied'
            )
            EventService.emit(AppEvents.APPLICATION_SUBMITTED, user, {"job_id": job.id, "application_id": application.id})

        return Response(ApplicationSerializer(application).data, status=http_status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def placement_analytics(self, request):
        """Management insights into career outcomes."""
        if not request.user.role in ['admin', 'super_admin']:
             raise PermissionDenied("Unauthorized to view placement analytics.")

        stats = JobPosting.objects.aggregate(
            total_jobs=Count('id'),
            total_applications=Count('applications'),
            selected_count=Count('applications', filter=Q(applications__status='selected')),
            avg_package=Avg('package')
        )
        
        dept_stats = Application.objects.values('student__department').annotate(
            placed=Count('id', filter=Q(status='selected')),
            total=Count('id')
        ).order_by('-placed')

        return Response({
            "summary": {
                "total_postings": stats['total_jobs'],
                "total_applications": stats['total_applications'],
                "placed_students": stats['selected_count'],
                "avg_package_offered": stats['avg_package'] or 0
            },
            "departmental_stats": list(dept_stats)
        })

class ApplicationViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Pipeline management viewset."""
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role in ['admin', 'super_admin', 'staff', 'faculty']:
            return qs
        return qs.filter(student=user)


    @action(detail=True, methods=['post'])
    def update_pipeline(self, request, pk=None):
        """Update student status in hiring pipeline."""
        application = self.get_object()
        new_status = request.data.get('status')
        feedback = request.data.get('feedback', '')

        if new_status not in dict(Application.STATUS_CHOICES):
             raise ValidationError("Invalid status.")

        application.status = new_status
        application.feedback = feedback
        application.save()

        # Emit events based on stage
        if new_status == 'shortlisted':
             EventService.emit(AppEvents.APPLICATION_SHORTLISTED, application.student, {"id": application.id})
        
        return Response({"status": f"Application moved to {new_status}"})

class OfferViewSet(CollegeScopeMixin, viewsets.ModelViewSet):
    """Offer generation and acceptance viewset."""
    queryset = Offer.objects.all()
    serializer_class = OfferSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role in ['admin', 'super_admin', 'staff', 'faculty']:
            return qs
        return qs.filter(student=user)


    def perform_create(self, serializer):
        offer = serializer.save()
        EventService.emit(AppEvents.OFFER_RELEASED, offer.student, {"id": offer.id, "job_title": offer.job.title})

    @action(detail=True, methods=['post'])
    def accept_offer(self, request, pk=None):
        """Student choice for career outcome."""
        offer = self.get_object()
        if offer.student != request.user:
             raise PermissionDenied("This offer belongs to another student.")

        offer.accepted = True
        offer.save()

        # Update placement record
        EventService.emit(AppEvents.STUDENT_PLACED, request.user, {"id": offer.id, "company": offer.company.name})
        
        return Response({"status": "Congratulations! You have accepted the offer."})
