from __future__ import annotations

import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.colleges.models import College
from apps.auth.models import User
from apps.notices.models import Notice
from apps.users.models import Tenant


@pytest.mark.django_db
@pytest.mark.api
class TestSuperAdminScopeApiRequests:
    def test_colleges_list_requires_authentication(self, api_client: APIClient):
        cache.clear()
        response = api_client.get('/api/colleges/colleges/', HTTP_HOST='localhost')
        assert response.status_code == 401

    def test_college_create_is_super_admin_only(self, api_client: APIClient, user_factory):
        cache.clear()
        admin = user_factory(username='ADMIN_SCOPE_1', role='admin')
        api_client.force_authenticate(user=admin)

        response = api_client.post(
            '/api/colleges/colleges/',
            {'name': 'Blocked College', 'code': 'BLC01', 'city': 'City', 'state': 'State'},
            format='json',
            HTTP_HOST='localhost',
        )

        assert response.status_code == 403

    def test_super_admin_dashboard_respects_college_scope(self, api_client: APIClient, user_factory):
        cache.clear()
        college_a = College.objects.create(name='Scope College A', code='SCA01', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Scope College B', code='SCB01', city='City', state='State', is_active=True)
        super_admin = user_factory(username='SCOPE_SUPER_1', role='super_admin')

        # scoped student counts should differ by college
        user_factory(username='SCOPE_A_STU_1', role='student', college=college_a)
        user_factory(username='SCOPE_A_STU_2', role='student', college=college_a)
        user_factory(username='SCOPE_B_STU_1', role='student', college=college_b)

        api_client.force_authenticate(user=super_admin)

        all_res = api_client.get('/api/metrics/dashboard/', HTTP_HOST='localhost')
        a_res = api_client.get(f'/api/metrics/dashboard/?college_id={college_a.id}', HTTP_HOST='localhost')
        b_res = api_client.get(f'/api/metrics/dashboard/?college_id={college_b.id}', HTTP_HOST='localhost')

        assert all_res.status_code == 200
        assert a_res.status_code == 200
        assert b_res.status_code == 200

        all_payload = all_res.json()
        a_payload = a_res.json()
        b_payload = b_res.json()

        assert isinstance(all_payload.get('total_students'), int)
        assert isinstance(a_payload.get('total_students'), int)
        assert isinstance(b_payload.get('total_students'), int)
        assert a_payload['scope_college_id'] == str(college_a.id)
        assert b_payload['scope_college_id'] == str(college_b.id)

    def test_non_super_admin_cannot_override_college_scope_in_dashboard(
        self, api_client: APIClient, user_factory
    ):
        cache.clear()
        college_a = College.objects.create(name='Admin College A', code='ACA01', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Admin College B', code='ACB01', city='City', state='State', is_active=True)
        admin = user_factory(username='ADMIN_SCOPE_2', role='admin', college=college_a)

        user_factory(username='ADMIN_A_STU_1', role='student', college=college_a)
        user_factory(username='ADMIN_B_STU_1', role='student', college=college_b)
        user_factory(username='ADMIN_B_STU_2', role='student', college=college_b)

        api_client.force_authenticate(user=admin)
        response = api_client.get(f'/api/metrics/dashboard/?college_id={college_b.id}', HTTP_HOST='localhost')

        assert response.status_code == 200
        payload = response.json()
        # Admin must remain in own college scope despite query parameter.
        assert payload['total_students'] == 1

    def test_super_admin_activities_respect_college_scope(self, api_client: APIClient, user_factory):
        cache.clear()
        college_a = College.objects.create(name='Feed College A', code='FCA01', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Feed College B', code='FCB01', city='City', state='State', is_active=True)
        super_admin = user_factory(username='SCOPE_SUPER_2', role='super_admin')
        author = user_factory(username='NOTICE_AUTHOR_1', role='admin', college=college_a)
        author_b = user_factory(username='NOTICE_AUTHOR_2', role='admin', college=college_b)

        Notice.objects.create(college=college_a, title='A-only notice', content='A feed', author=author, is_published=True)
        Notice.objects.create(college=college_b, title='B-only notice', content='B feed', author=author_b, is_published=True)

        api_client.force_authenticate(user=super_admin)
        response = api_client.get(f'/api/metrics/activities/?college_id={college_a.id}', HTTP_HOST='localhost')
        assert response.status_code == 200

        payload = response.json()
        assert isinstance(payload, list)

    def test_super_admin_users_and_tenants_college_filters(self, api_client: APIClient, user_factory):
        cache.clear()
        college_a = College.objects.create(name='UserScope College A', code='USA01', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='UserScope College B', code='USB01', city='City', state='State', is_active=True)
        super_admin = user_factory(username='SCOPE_SUPER_3', role='super_admin')

        student_a = user_factory(username='TENANT_A_1', role='student', college=college_a)
        user_factory(username='TENANT_B_1', role='student', college=college_b)
        user_factory(username='STAFF_A_1', role='staff', college=college_a)
        user_factory(username='STAFF_B_1', role='staff', college=college_b)
        Tenant.objects.create(user=student_a, college_code=college_a.code)

        api_client.force_authenticate(user=super_admin)

        users_res = api_client.get(f'/api/auth/users/?college={college_a.id}', HTTP_HOST='localhost')
        assert users_res.status_code == 200
        user_items = users_res.json().get('results', [])
        assert user_items
        assert isinstance(user_items, list)

        tenants_res = api_client.get(f'/api/users/tenants/?user__college={college_a.id}', HTTP_HOST='localhost')
        assert tenants_res.status_code == 200
        tenant_items = tenants_res.json().get('results', [])
        assert isinstance(tenant_items, list)

    def test_super_admin_user_filters_match_db_for_combined_conditions(
        self, api_client: APIClient, user_factory
    ):
        cache.clear()
        college_a = College.objects.create(name='Filter College A', code='FCA11', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Filter College B', code='FCB11', city='City', state='State', is_active=True)
        super_admin = user_factory(username='FILTER_SUPER_1', role='super_admin')

        target_1 = user_factory(username='FILTER_STAFF_A_1', role='staff', college=college_a, is_active=True)
        user_factory(username='FILTER_STAFF_A_2', role='staff', college=college_a, is_active=False)
        user_factory(username='FILTER_STAFF_B_1', role='staff', college=college_b, is_active=True)
        user_factory(username='FILTER_ADMIN_A_1', role='admin', college=college_a, is_active=True)

        api_client.force_authenticate(user=super_admin)
        response = api_client.get(
            f'/api/auth/users/?college={college_a.id}&role=staff&is_active=true',
            HTTP_HOST='localhost',
        )
        assert response.status_code == 200
        payload = response.json().get('results', [])

        expected_ids = {
            str(pk) for pk in User.objects.filter(college=college_a, role='staff', is_active=True).values_list('id', flat=True)
        }
        api_ids = {item.get('id') for item in payload}

        assert expected_ids == api_ids
        assert str(target_1.id) in api_ids

    def test_super_admin_tenant_filters_match_db_for_combined_conditions(
        self, api_client: APIClient, user_factory
    ):
        cache.clear()
        college_a = College.objects.create(name='Tenant Filter A', code='TFA11', city='City', state='State', is_active=True)
        college_b = College.objects.create(name='Tenant Filter B', code='TFB11', city='City', state='State', is_active=True)
        super_admin = user_factory(username='TENANT_FILTER_SUPER', role='super_admin')

        student_a_active = user_factory(username='TENANT_FILTER_A_1', role='student', college=college_a, is_active=True)
        student_a_inactive = user_factory(username='TENANT_FILTER_A_2', role='student', college=college_a, is_active=False)
        student_b_active = user_factory(username='TENANT_FILTER_B_1', role='student', college=college_b, is_active=True)
        Tenant.objects.create(user=student_a_active, college_code=college_a.code)
        Tenant.objects.create(user=student_a_inactive, college_code=college_a.code)
        Tenant.objects.create(user=student_b_active, college_code=college_b.code)

        api_client.force_authenticate(user=super_admin)
        response = api_client.get(
            f'/api/users/tenants/?user__college={college_a.id}&user__is_active=true',
            HTTP_HOST='localhost',
        )
        assert response.status_code == 200
        payload = response.json().get('results', [])

        expected_ids = {
            str(pk) for pk in Tenant.objects.filter(user__college=college_a, user__is_active=True).values_list('id', flat=True)
        }
        api_ids = {item.get('id') for item in payload}
        assert expected_ids == api_ids

