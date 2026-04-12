from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from apps.colleges.models import College
from apps.users.models import Tenant


@pytest.mark.django_db
@pytest.mark.api
class TestAdminCollegeScopeApiRequests:
    def test_college_admin_tenants_list_scoped_to_own_college(self, api_client: APIClient, user_factory):
        college_a = College.objects.create(name='AdminScope A', code='ASA01', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='AdminScope B', code='ASB01', city='City', state='State', is_active=True)
        admin_a = user_factory(username='ADMIN_SCOPE_A', role='admin', college=college_a)
        stu_a = user_factory(username='STU_A_ONLY', role='student', college=college_a)
        stu_b = user_factory(username='STU_B_ONLY', role='student', college=college_b)
        Tenant.objects.create(user=stu_a, college_code=college_a.code)
        Tenant.objects.create(user=stu_b, college_code=college_b.code)

        api_client.force_authenticate(user=admin_a)
        response = api_client.get('/api/users/tenants/', HTTP_HOST='localhost')
        assert response.status_code == 200
        results = response.json().get('results', [])
        usernames = {row.get('user', {}).get('username') for row in results}
        assert 'STU_A_ONLY' in usernames
        assert 'STU_B_ONLY' not in usernames

    def test_college_admin_cannot_update_role_for_other_college_user(self, api_client: APIClient, user_factory):
        college_a = College.objects.create(name='Gov A', code='GOVA1', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Gov B', code='GOVB1', city='City', state='State', is_active=True)
        admin_a = user_factory(username='GOV_ADMIN_A', role='admin', college=college_a)
        target_b = user_factory(username='GOV_TARGET_B', role='student', college=college_b)

        api_client.force_authenticate(user=admin_a)
        response = api_client.post(
            '/api/operations/control/update_role/',
            {'user_id': target_b.id, 'role': 'staff'},
            format='json',
            HTTP_HOST='localhost',
        )
        assert response.status_code == 403

    def test_college_admin_can_update_role_within_own_college(self, api_client: APIClient, user_factory):
        college_a = College.objects.create(name='Gov Allow A', code='GAA01', city='City', state='State', is_active=True)
        admin_a = user_factory(username='GOV_ALLOW_ADMIN_A', role='admin', college=college_a)
        target_a = user_factory(username='GOV_ALLOW_TARGET_A', role='student', college=college_a)

        api_client.force_authenticate(user=admin_a)
        response = api_client.post(
            '/api/operations/control/update_role/',
            {'user_id': target_a.id, 'role': 'staff'},
            format='json',
            HTTP_HOST='localhost',
        )
        assert response.status_code == 200

    def test_college_admin_audit_trail_excludes_other_colleges(self, api_client: APIClient, user_factory):
        college_a = College.objects.create(name='Audit A', code='AUDA1', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Audit B', code='AUDB1', city='City', state='State', is_active=True)
        admin_a = user_factory(username='AUDIT_ADMIN_A', role='admin', college=college_a)
        admin_b = user_factory(username='AUDIT_ADMIN_B', role='admin', college=college_b)
        stu_a = user_factory(username='AUDIT_STU_A', role='student', college=college_a)
        stu_b = user_factory(username='AUDIT_STU_B', role='student', college=college_b)

        # Create audit rows via governance API (same college only for each admin).
        client = APIClient()
        client.force_authenticate(user=admin_a)
        r1 = client.post(
            '/api/operations/control/update_role/',
            {'user_id': stu_a.id, 'role': 'staff'},
            format='json',
            HTTP_HOST='localhost',
        )
        assert r1.status_code == 200

        client.force_authenticate(user=admin_b)
        r2 = client.post(
            '/api/operations/control/update_role/',
            {'user_id': stu_b.id, 'role': 'staff'},
            format='json',
            HTTP_HOST='localhost',
        )
        assert r2.status_code == 200

        api_client.force_authenticate(user=admin_a)
        trail = api_client.get('/api/operations/control/audit_trail/', HTTP_HOST='localhost')
        assert trail.status_code == 200
        payload = trail.json()
        assert isinstance(payload, list)
        actor_ids = {str(row.get('actor')) for row in payload if row.get('actor') is not None}
        assert str(admin_a.id) in actor_ids
        assert str(admin_b.id) not in actor_ids
