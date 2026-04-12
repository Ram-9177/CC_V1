from __future__ import annotations

from datetime import date

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.attendance.models import Attendance
from apps.analytics.models import DailyHostelMetrics
from apps.colleges.models import College
from apps.complaints.models import Complaint
from apps.gate_passes.models import GatePass
from apps.health.models import HealthCheck


@pytest.mark.django_db
@pytest.mark.api
class TestMetricsReportsHealthRegressions:
    def test_hostel_analytics_uses_active_allocation_relation(
        self,
        api_client: APIClient,
        user_factory,
        building_factory,
        room_factory,
        bed_factory,
        allocation_factory,
        gate_pass_factory,
    ):
        cache.clear()

        college = College.objects.create(name='Analytics College', code='ANL01', city='Analytics City', state='Analytics State', is_active=True)
        admin = user_factory(username='ANALYTICS_ADMIN', role='admin', college=college)
        student = user_factory(username='ANALYTICS_STUDENT', role='student', college=college)
        building = building_factory(name='Analytics Block', code='ABL001', college=college)
        room = room_factory(building=building, room_number='A-101', college=college, created_by=admin)
        bed_factory(room=room, is_occupied=True)
        allocation_factory(student=student, room=room, college=college)
        Complaint.objects.create(
            college=college,
            student=student,
            category='electrical',
            title='Analytics complaint',
            description='Needs repair',
            status='open',
        )
        gate_pass_factory(student=student, status='pending', college=college)

        api_client.force_authenticate(user=admin)

        response = api_client.get('/api/metrics/analytics/', HTTP_HOST='localhost')

        assert response.status_code == 200
        payload = response.json()
        assert payload['hostel_wise_metrics'][0]['building_name'] == building.name
        assert payload['hostel_wise_metrics'][0]['complaints_count'] == 1
        assert payload['hostel_wise_metrics'][0]['gate_passes']['pending'] == 1

    def test_dashboard_summary_wraps_shared_payload_without_reentering_drf(
        self,
        authenticated_api_client: APIClient,
        message_factory,
        user_factory,
        authenticated_user,
    ):
        cache.clear()

        sender = user_factory(username='SUMMARY_SENDER', role='admin')
        message_factory(sender=sender, recipient=authenticated_user, is_read=False)

        response = authenticated_api_client.get('/api/metrics/dashboard/summary/', HTTP_HOST='localhost')

        assert response.status_code == 200
        payload = response.json()
        assert payload['success'] is True
        assert payload['message'] == 'Dashboard summary fetched'
        assert payload['data']['unread_messages'] == 1

    @pytest.mark.parametrize('period', ['week', 'month'])
    def test_attendance_report_groups_datefield_without_sqlite_truncdate_crash(
        self,
        api_client: APIClient,
        user_factory,
        period: str,
    ):
        cache.clear()

        today = timezone.now().date()
        college = College.objects.create(name=f'Attendance College {period}', code=f'AT{period[:2].upper()}1', city='Attendance City', state='Attendance State', is_active=True)
        admin = user_factory(username=f'ATT_ADMIN_{period.upper()}', role='admin', college=college)
        present_student = user_factory(username=f'ATT_PRESENT_{period.upper()}', role='student', college=college)
        absent_student = user_factory(username=f'ATT_ABSENT_{period.upper()}', role='student', college=college)
        Attendance.objects.create(college=college, user=present_student, attendance_date=today, status='present')
        Attendance.objects.create(college=college, user=absent_student, attendance_date=today, status='absent')

        api_client.force_authenticate(user=admin)

        response = api_client.get(f'/api/reports/attendance/?period={period}', HTTP_HOST='localhost')

        assert response.status_code == 200
        payload = response.json()
        assert payload[0]['date'] == today.strftime('%Y-%m-%d')
        assert payload[0]['present'] == 1
        assert payload[0]['absent'] == 1
        assert payload[0]['total'] == 2

    def test_health_latest_falls_back_to_live_status_when_history_is_empty(
        self,
        api_client: APIClient,
    ):
        cache.clear()
        HealthCheck.objects.all().delete()

        response = api_client.get('/api/health-check/health/latest/', HTTP_HOST='localhost')

        assert response.status_code == 200
        payload = response.json()
        assert payload['status'] in {'healthy', 'degraded', 'unhealthy'}
        assert 'database_status' in payload
        assert 'cache_status' in payload

    def test_dashboard_stats_refresh_bypasses_cache_and_matches_latest_db(
        self,
        api_client: APIClient,
        user_factory,
        gate_pass_factory,
    ):
        cache.clear()
        college = College.objects.create(name='Stats Fresh College', code='SFC01', city='City', state='State', is_active=True)
        admin = user_factory(username='STATS_FRESH_ADMIN', role='admin', college=college)
        student = user_factory(username='STATS_FRESH_STUDENT', role='student', college=college)
        api_client.force_authenticate(user=admin)

        first = api_client.get('/api/metrics/dashboard/stats/', HTTP_HOST='localhost')
        assert first.status_code == 200
        first_count = first.json()['data']['out_students_count']

        gate_pass_factory(student=student, status='out', college=college)
        db_count = GatePass.objects.filter(
            college=college, status__in=['approved', 'used', 'out', 'outside']
        ).count()

        cached = api_client.get('/api/metrics/dashboard/stats/', HTTP_HOST='localhost')
        assert cached.status_code == 200
        assert cached.json()['data']['out_students_count'] == first_count

        fresh = api_client.get('/api/metrics/dashboard/stats/?fresh=1', HTTP_HOST='localhost')
        assert fresh.status_code == 200
        assert fresh.json()['data']['out_students_count'] == db_count

    def test_recent_activities_refresh_includes_new_records_immediately(
        self,
        api_client: APIClient,
        user_factory,
        gate_pass_factory,
    ):
        cache.clear()
        college = College.objects.create(name='Activity Fresh College', code='AFC01', city='City', state='State', is_active=True)
        admin = user_factory(username='ACTIVITY_FRESH_ADMIN', role='admin', college=college)
        student = user_factory(username='ACTIVITY_FRESH_STUDENT', role='student', college=college)
        api_client.force_authenticate(user=admin)

        base = api_client.get('/api/metrics/activities/', HTTP_HOST='localhost')
        assert base.status_code == 200
        base_len = len(base.json())

        gate_pass_factory(
            student=student,
            college=college,
            status='pending',
            reason='Fresh feed gate pass',
            destination='City',
        )

        stale = api_client.get('/api/metrics/activities/', HTTP_HOST='localhost')
        assert stale.status_code == 200
        assert len(stale.json()) == base_len

        refreshed = api_client.get('/api/metrics/activities/?refresh=true', HTTP_HOST='localhost')
        assert refreshed.status_code == 200
        refreshed_items = refreshed.json()
        assert len(refreshed_items) >= base_len
        assert any(item.get('type') == 'gate_pass' for item in refreshed_items)

    def test_dashboard_fast_path_uses_valid_daily_metrics_fields(
        self,
        api_client: APIClient,
        user_factory,
    ):
        cache.clear()
        today = timezone.localdate()
        college = College.objects.create(name='FastPath College', code='FPC01', city='City', state='State', is_active=True)
        admin = user_factory(username='FASTPATH_ADMIN', role='admin', college=college)
        student = user_factory(username='FASTPATH_STU', role='student', college=college, is_active=True)
        Complaint.objects.create(
            college=college,
            student=student,
            category='electrical',
            title='Fast path complaint',
            description='open complaint',
            status='open',
        )
        GatePass.objects.create(
            college=college,
            student=student,
            pass_type='day',
            status='pending',
            reason='Family visit',
            destination='City',
            exit_date=timezone.now(),
        )
        DailyHostelMetrics.objects.update_or_create(
            tenant_id=str(college.id),
            date=today,
            defaults={
                'total_students': 1,
                'students_outside': 0,
                'gate_passes_issued': 999,  # Should NOT be used as pending
                'complaint_counts_by_category': {'electrical': 1},
            },
        )

        api_client.force_authenticate(user=admin)
        response = api_client.get('/api/metrics/dashboard/?fresh=1', HTTP_HOST='localhost')
        assert response.status_code == 200
        payload = response.json()
        assert payload['total_students'] == 1
        assert payload['pending_gate_passes'] == 1
        assert payload['pending_complaints'] == 1

    def test_no_college_non_super_admin_dashboard_isolation_returns_empty_scope(
        self,
        api_client: APIClient,
        user_factory,
    ):
        cache.clear()
        college = College.objects.create(name='Leak Guard College', code='LGC01', city='City', state='State', is_active=True)
        user_factory(username='LEAK_GUARD_STUDENT', role='student', college=college, is_active=True)
        admin_without_college = user_factory(username='LEAK_GUARD_ADMIN', role='admin', college=None)

        api_client.force_authenticate(user=admin_without_college)
        dashboard_res = api_client.get('/api/metrics/dashboard/?fresh=1', HTTP_HOST='localhost')
        stats_res = api_client.get('/api/metrics/dashboard/stats/?fresh=1', HTTP_HOST='localhost')
        out_res = api_client.get('/api/metrics/dashboard/out/?fresh=1', HTTP_HOST='localhost')

        assert dashboard_res.status_code == 200
        assert stats_res.status_code == 200
        assert out_res.status_code == 200

        dashboard = dashboard_res.json()
        stats = stats_res.json()['data']
        out_data = out_res.json()['data']

        assert dashboard['total_students'] == 0
        assert dashboard['pending_requests'] == 0
        assert stats['out_students_count'] == 0
        assert stats['pending_complaints'] == 0
        assert out_data == []