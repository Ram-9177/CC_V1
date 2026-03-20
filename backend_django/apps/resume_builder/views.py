"""Resume Builder views."""
import logging
from django.http import HttpResponse
from django.core.cache import cache
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle

from .models import ResumeProfile
from .serializers import ResumeProfileSerializer, ResumeUpdateSerializer
from .templates import list_templates, get_template
from .ai_service import generate_resume
from .pdf_service import generate_pdf

logger = logging.getLogger(__name__)


class StudentOnlyMixin:
    """Restrict endpoint to student role."""
    def check_permissions(self, request):
        super().check_permissions(request)
        if getattr(request.user, 'role', None) != 'student':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only students can access the resume builder.")


class ResumeProfileView(StudentOnlyMixin, APIView):
    """GET → fetch profile. POST → create/update profile."""
    permission_classes = [IsAuthenticated]

    def _get_or_create_profile(self, user):
        profile, _ = ResumeProfile.objects.get_or_create(
            user=user,
            defaults={'college': getattr(user, 'college', None)},
        )
        return profile

    def get(self, request):
        profile = self._get_or_create_profile(request.user)
        return Response(ResumeProfileSerializer(profile).data)

    def post(self, request):
        profile = self._get_or_create_profile(request.user)
        serializer = ResumeProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # Invalidate cached preview on profile change
        cache.delete(f"resume_preview:{request.user.id}")
        return Response(serializer.data)


class ResumeTemplatesView(APIView):
    """GET → list all available ATS templates."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(list_templates())


class ResumeGenerateThrottle(UserRateThrottle):
    rate = '10/day'
    scope = 'resume_generate'


class ResumeGenerateView(StudentOnlyMixin, APIView):
    """POST → trigger AI generation. Respects 3/day limit."""
    permission_classes = [IsAuthenticated]
    throttle_classes = [ResumeGenerateThrottle]

    def post(self, request):
        try:
            profile = ResumeProfile.objects.get(user=request.user)
        except ResumeProfile.DoesNotExist:
            return Response(
                {'detail': 'Please save your profile first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not profile.full_name:
            return Response(
                {'detail': 'Please fill in your full name before generating.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reuse if generated within last 10 minutes and not forced
        force = request.data.get('force', False)
        if not force and profile.generated_resume and profile.last_generated_at:
            from django.utils import timezone
            age = (timezone.now() - profile.last_generated_at).total_seconds()
            if age < 600:  # 10 minutes
                return Response({
                    'detail': 'Using recent generation.',
                    'generated_resume': profile.generated_resume,
                    'cached': True,
                })

        if not profile.can_generate():
            return Response(
                {'detail': 'Daily generation limit reached (3/day). Try again tomorrow.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        try:
            result = generate_resume(profile)
        except Exception as exc:
            logger.error(f"Resume generation error for user {request.user.id}: {exc}")
            return Response(
                {'detail': 'Generation failed. Please try again.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        profile.generated_resume = result
        profile.record_generation()

        # Invalidate cached preview
        cache.delete(f"resume_preview:{request.user.id}")

        return Response({
            'generated_resume': result,
            'cached': False,
            'generations_today': profile.generation_count,
            'generations_remaining': max(0, 3 - profile.generation_count),
        })


class ResumePreviewView(StudentOnlyMixin, APIView):
    """GET → return resume data + template config for frontend rendering."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = f"resume_preview:{request.user.id}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        try:
            profile = ResumeProfile.objects.get(user=request.user)
        except ResumeProfile.DoesNotExist:
            return Response({'detail': 'No resume profile found.'}, status=status.HTTP_404_NOT_FOUND)

        if not profile.generated_resume:
            return Response({'detail': 'Resume not generated yet.'}, status=status.HTTP_404_NOT_FOUND)

        template_config = get_template(profile.selected_template)
        payload = {
            'resume': profile.generated_resume,
            'template': template_config,
            'meta': {
                'full_name': profile.full_name,
                'email': profile.email,
                'phone': profile.phone,
                'linkedin': profile.linkedin,
                'github': profile.github,
                'course': profile.course,
                'branch': profile.branch,
                'year': profile.year,
            },
        }

        cache.set(cache_key, payload, 300)  # 5 min TTL
        return Response(payload)


class ResumeUpdateView(StudentOnlyMixin, APIView):
    """POST → save manual edits to generated_resume. No AI re-trigger."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            profile = ResumeProfile.objects.get(user=request.user)
        except ResumeProfile.DoesNotExist:
            return Response({'detail': 'No resume profile found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ResumeUpdateSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        cache.delete(f"resume_preview:{request.user.id}")
        return Response({'detail': 'Resume updated.', 'generated_resume': profile.generated_resume})


class ResumeDownloadView(StudentOnlyMixin, APIView):
    """GET → stream PDF download."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            profile = ResumeProfile.objects.get(user=request.user)
        except ResumeProfile.DoesNotExist:
            return Response({'detail': 'No resume profile found.'}, status=status.HTTP_404_NOT_FOUND)

        if not profile.generated_resume:
            return Response({'detail': 'Generate your resume first.'}, status=status.HTTP_400_BAD_REQUEST)

        template_config = get_template(profile.selected_template)

        try:
            pdf_bytes = generate_pdf(profile.generated_resume, template_config, profile)
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_501_NOT_IMPLEMENTED)
        except Exception as exc:
            logger.error(f"PDF generation error for user {request.user.id}: {exc}")
            return Response({'detail': 'PDF generation failed.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        filename = f"resume_{profile.full_name.replace(' ', '_') or request.user.username}.pdf"
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
