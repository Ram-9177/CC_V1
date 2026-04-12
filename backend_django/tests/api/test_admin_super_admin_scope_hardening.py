from __future__ import annotations

import pytest
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from apps.analytics.models import DailyHostelMetrics
from apps.colleges.models import College


@pytest.mark.django_db
@pytest.mark.api
class TestAdminSuperAdminScopeHardening:
    def test_super_admin_metrics_dashboard_invalid_college_scope_returns_400(
        self, api_client: APIClient, user_factory
    ):
        super_admin = user_factory(username='HARDEN_SA_1', role='super_admin')
        api_client.force_authenticate(user=super_admin)

        response = api_client.get('/api/metrics/dashboard/?college_id=not-a-real-id', HTTP_HOST='localhost')
        assert response.status_code == 400

    def test_super_admin_analytics_overview_respects_college_scope(
        self, api_client: APIClient, user_factory
    ):
        cache.clear()
        college_a = College.objects.create(name='Analytics Hard A', code='AHA01', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Analytics Hard B', code='AHB01', city='City', state='State', is_active=True)
        super_admin = user_factory(username='HARDEN_SA_2', role='super_admin')

        DailyHostelMetrics.objects.create(
            tenant_id=str(college_a.id),
            date=timezone.localdate(),
            total_students=20,
            students_present=17,
            students_outside=3,
        )
        DailyHostelMetrics.objects.create(
            tenant_id=str(college_b.id),
            date=timezone.localdate(),
            total_students=80,
            students_present=70,
            students_outside=10,
        )

        api_client.force_authenticate(user=super_admin)
        scoped = api_client.get(
            f'/api/analytics/dashboard/overview/?college_id={college_a.id}',
            HTTP_HOST='localhost',
        )
        assert scoped.status_code == 200
        assert scoped.json().get('total_students') == 20

    def test_system_settings_are_college_scoped_for_admin(self, api_client: APIClient, user_factory):
        cache.clear()
        college_a = College.objects.create(name='Settings Hard A', code='SHA01', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Settings Hard B', code='SHB01', city='City', state='State', is_active=True)
        admin_a = user_factory(username='HARDEN_ADMIN_A', role='admin', college=college_a)
        admin_b = user_factory(username='HARDEN_ADMIN_B', role='admin', college=college_b)

        api_client.force_authenticate(user=admin_a)
        put_a = api_client.put(
            '/api/core/settings/',
            {'maintenance_mode': True, 'maintenance_message': 'College A only'},
            format='json',
            HTTP_HOST='localhost',
        )
        assert put_a.status_code == 200

        api_client.force_authenticate(user=admin_b)
        get_b = api_client.get('/api/core/settings/', HTTP_HOST='localhost')
        assert get_b.status_code == 200
        payload_b = get_b.json()
        assert payload_b.get('maintenance_mode') is False

