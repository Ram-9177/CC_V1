"""Resume Builder serializers."""
from rest_framework import serializers
from .models import ResumeProfile


class ResumeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResumeProfile
        fields = [
            'id', 'full_name', 'email', 'phone', 'linkedin', 'github',
            'course', 'branch', 'year',
            'skills', 'education', 'projects', 'experience',
            'achievements', 'certifications', 'summary',
            'selected_template', 'generated_resume', 'last_generated_at',
            'generation_count', 'generation_date', 'updated_at',
        ]
        read_only_fields = ['generated_resume', 'last_generated_at', 'generation_count', 'generation_date', 'updated_at']

    def validate_skills(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("skills must be a list.")
        return value

    def validate_projects(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("projects must be a list.")
        return value

    def validate_education(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("education must be a list.")
        return value

    def validate_experience(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("experience must be a list.")
        return value


class ResumeUpdateSerializer(serializers.ModelSerializer):
    """For manual edits to generated_resume JSON — no AI re-trigger."""
    class Meta:
        model = ResumeProfile
        fields = ['generated_resume', 'selected_template']
