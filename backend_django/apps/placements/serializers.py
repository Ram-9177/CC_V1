"""Placements app serializers — Phase 7."""
from rest_framework import serializers
from .models import Company, JobPosting, Application, Offer
from apps.auth.serializers import UserSerializer


JOB_STATUS_INPUT_MAP = {
    'active': 'open',
    'open': 'open',
    'closed': 'closed',
    'draft': 'pending_approval',
    'pending_approval': 'pending_approval',
}

JOB_STATUS_OUTPUT_MAP = {
    'open': 'active',
    'pending_approval': 'draft',
}

class CompanySerializer(serializers.ModelSerializer):
    """Company model serializer."""
    class Meta:
        model = Company
        fields = '__all__'
        read_only_fields = ['college', 'created_at', 'updated_at']

class JobPostingSerializer(serializers.ModelSerializer):
    """Job vacancy serializer."""
    company = CompanySerializer(read_only=True)
    company_details = CompanySerializer(source='company', read_only=True)
    company_id = serializers.PrimaryKeyRelatedField(source='company', queryset=Company.objects.all(), write_only=True, required=False)

    status = serializers.CharField(required=False)
    application_count = serializers.SerializerMethodField()
    my_application_status = serializers.SerializerMethodField()
    
    class Meta:
        model = JobPosting
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_application_count(self, obj):
        return obj.applications.count()

    def get_my_application_status(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return None
        if getattr(user, 'role', None) != 'student':
            return None
        app = obj.applications.filter(student=user).order_by('-created_at').first()
        return app.status if app else None

    def validate_status(self, value):
        normalized = (value or '').strip().lower()
        mapped = JOB_STATUS_INPUT_MAP.get(normalized)
        if not mapped:
            raise serializers.ValidationError('Invalid job status.')
        return mapped

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['status'] = JOB_STATUS_OUTPUT_MAP.get(data.get('status'), data.get('status'))
        return data

class ApplicationSerializer(serializers.ModelSerializer):
    """Job application serializer."""
    student_details = UserSerializer(source='student', read_only=True)
    job = JobPostingSerializer(read_only=True)
    job_id = serializers.PrimaryKeyRelatedField(source='job', queryset=JobPosting.objects.all(), write_only=True, required=False)
    job_details = JobPostingSerializer(source='job', read_only=True)
    applied_at = serializers.DateTimeField(source='created_at', read_only=True)
    
    class Meta:
        model = Application
        fields = '__all__'
        read_only_fields = ['student', 'created_at', 'updated_at']

class OfferSerializer(serializers.ModelSerializer):
    """Offer model serializer."""
    student_details = UserSerializer(source='student', read_only=True)
    job_details = JobPostingSerializer(source='job', read_only=True)
    
    class Meta:
        model = Offer
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
