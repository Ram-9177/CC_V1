from __future__ import annotations

from datetime import date

import pytest
from rest_framework.test import APIClient

from apps.attendance.models import Attendance, AttendanceReport
from apps.colleges.models import College


@pytest.mark.django_db(transaction=True)
@pytest.mark.api
class TestAttendanceReportSecurity:
    def test_generate_report_rejects_cross_college_target(
        self,
        api_client: APIClient,
        user_factory,
    ):
        college_a = College.objects.create(name='College A', code='COLA1', city='City A', state='State A', is_active=True)
        college_b = College.objects.create(name='College B', code='COLB1', city='City B', state='State B', is_active=True)

        warden = user_factory(
            username='WARDEN_REP_A',
            registration_number='WARDEN_REP_A',
            password='Attendance123',
            role='warden',
            college=college_a,
            is_password_changed=True,
        )
        student = user_factory(
            username='STUDENT_REP_B',
            registration_number='STUDENT_REP_B',
            password='Attendance123',
            role='student',
            college=college_b,
            is_password_changed=True,
        )

        Attendance.objects.create(
            college=college_b,
            user=student,
            attendance_date=date.today(),
            status='present',
        )

        api_client.force_authenticate(user=warden)
        response = api_client.post(
            '/api/attendance/reports/generate_report/',
            data={'user_id': str(student.id), 'period': 'daily'},
            format='json',
        )

        assert response.status_code == 404
        assert AttendanceReport.objects.count() == 0

    def test_generate_report_persists_college_and_tenant_id(
        self,
        api_client: APIClient,
        user_factory,
    ):
        college = College.objects.create(name='Reports College', code='REPC1', city='Report City', state='Report State', is_active=True)

        warden = user_factory(
            username='WARDEN_REP_OK',
            registration_number='WARDEN_REP_OK',
            password='Attendance123',
            role='warden',
            college=college,
            is_password_changed=True,
        )
        student = user_factory(
            username='STUDENT_REP_OK',
            registration_number='STUDENT_REP_OK',
            password='Attendance123',
            role='student',
            college=college,
            is_password_changed=True,
        )

        Attendance.objects.create(
            college=college,
            user=student,
            attendance_date=date.today(),
            status='present',
        )

        api_client.force_authenticate(user=warden)
        response = api_client.post(
            '/api/attendance/reports/generate_report/',
            data={'user_id': str(student.id), 'period': 'daily'},
            format='json',
        )

        assert response.status_code == 201

        report = AttendanceReport.objects.get(
            user=student,
            period='daily',
            start_date=date.today(),
            end_date=date.today(),
        )
        assert report.college_id == college.id
        assert report.tenant_id == str(college.id)
        assert report.total_days == 1
        assert report.present_days == 1
        assert report.percentage == 100.0

    def test_generate_report_reuses_existing_period_record(
        self,
        api_client: APIClient,
        user_factory,
    ):
        college = College.objects.create(name='Reports College 2', code='REPC2', city='Report City 2', state='Report State 2', is_active=True)

        warden = user_factory(
            username='WARDEN_REUSE',
            registration_number='WARDEN_REUSE',
            password='Attendance123',
            role='warden',
            college=college,
            is_password_changed=True,
        )
        student = user_factory(
            username='STUDENT_REUSE',
            registration_number='STUDENT_REUSE',
            password='Attendance123',
            role='student',
            college=college,
            is_password_changed=True,
        )

        Attendance.objects.create(
            college=college,
            user=student,
            attendance_date=date.today(),
            status='present',
        )

        api_client.force_authenticate(user=warden)
        endpoint = '/api/attendance/reports/generate_report/'
        first = api_client.post(endpoint, data={'user_id': str(student.id), 'period': 'daily'}, format='json')
        second = api_client.post(endpoint, data={'user_id': str(student.id), 'period': 'daily'}, format='json')

        assert first.status_code == 201
        assert second.status_code == 201
        assert AttendanceReport.objects.filter(
            user=student,
            period='daily',
            start_date=date.today(),
            end_date=date.today(),
        ).count() == 1