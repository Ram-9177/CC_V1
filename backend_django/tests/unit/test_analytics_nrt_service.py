from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.analytics.models import DailyHostelMetrics
from apps.colleges.models import College
from apps.gate_passes.models import GatePass


@pytest.mark.django_db
class TestAnalyticsNRTService:
    def test_out_status_creation_never_writes_negative_metrics(self, user_factory):
        college = College.objects.create(
            name='NRT College A',
            code='NRTA',
            city='Chennai',
            state='TN',
        )
        student = user_factory(
            username='NRT_STUDENT_A',
            registration_number='NRT_STUDENT_A',
            role='student',
            student_type='hosteller',
            college=college,
        )

        now = timezone.now()
        GatePass.objects.create(
            student=student,
            college=college,
            pass_type='day',
            status='out',
            exit_date=now + timedelta(hours=1),
            entry_date=now + timedelta(hours=6),
            reason='NRT seed validation',
            destination='Home',
        )

        metrics = DailyHostelMetrics.objects.get(
            tenant_id=str(college.id),
            date=now.date(),
        )

        assert metrics.students_present >= 0
        assert metrics.students_outside >= 0
        assert metrics.students_outside == 1

    def test_out_to_in_transition_restores_inside_count(self, user_factory):
        college = College.objects.create(
            name='NRT College B',
            code='NRTB',
            city='Madurai',
            state='TN',
        )
        user_factory(
            username='NRT_STUDENT_B1',
            registration_number='NRT_STUDENT_B1',
            role='student',
            student_type='hosteller',
            college=college,
        )
        student = user_factory(
            username='NRT_STUDENT_B2',
            registration_number='NRT_STUDENT_B2',
            role='student',
            student_type='hosteller',
            college=college,
        )

        now = timezone.now()
        gate_pass = GatePass.objects.create(
            student=student,
            college=college,
            pass_type='day',
            status='out',
            exit_date=now + timedelta(hours=2),
            entry_date=now + timedelta(hours=8),
            reason='Status transition validation',
            destination='Market',
        )

        metrics = DailyHostelMetrics.objects.get(tenant_id=str(college.id), date=now.date())
        assert metrics.students_outside == 1

        gate_pass.status = 'in'
        gate_pass.save(update_fields=['status'])

        metrics.refresh_from_db()
        assert metrics.students_outside == 0
        assert metrics.students_present >= 0
