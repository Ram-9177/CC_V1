from __future__ import annotations

from datetime import date, time, timedelta

import pytest
from django.db import IntegrityError, transaction

from apps.attendance.models import AttendanceReport
from apps.colleges.models import College
from apps.hall_booking.models import Hall, HallSlot
from apps.leaves.models import LeaveApplication
from apps.meals.models import Meal, MealFeedback


@pytest.mark.django_db(transaction=True)
class TestDatabaseConstraints:
    def test_base_model_syncs_tenant_id_from_college(self, user_factory):
        college = College.objects.create(name='Tenant Sync College', code='SYNC1', city='Sync City', state='Sync State', is_active=True)
        student = user_factory(
            username='SYNC_STUDENT',
            registration_number='SYNC_STUDENT',
            password='TenantSync123',
            role='student',
            college=college,
            is_password_changed=True,
        )

        leave = LeaveApplication.objects.create(
            college=college,
            student=student,
            leave_type='personal',
            start_date=date.today(),
            end_date=date.today(),
            reason='Tenant sync check',
        )

        assert leave.tenant_id == str(college.id)

        leave.tenant_id = 'mismatch'
        leave.save()
        leave.refresh_from_db()
        assert leave.tenant_id == str(college.id)

    def test_attendance_report_unique_period_window(self, user_factory):
        college = College.objects.create(name='Report Unique College', code='AUR1', city='Unique City', state='Unique State', is_active=True)
        student = user_factory(
            username='ATT_REPORT_UNIQ',
            registration_number='ATT_REPORT_UNIQ',
            password='Attendance123',
            role='student',
            college=college,
            is_password_changed=True,
        )

        AttendanceReport.objects.create(
            college=college,
            user=student,
            period='daily',
            start_date=date.today(),
            end_date=date.today(),
            total_days=1,
            present_days=1,
            percentage=100.0,
        )

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                AttendanceReport.objects.create(
                    college=college,
                    user=student,
                    period='daily',
                    start_date=date.today(),
                    end_date=date.today(),
                    total_days=1,
                    present_days=1,
                    percentage=100.0,
                )

    def test_leave_application_enforces_date_order_at_db_level(self, user_factory):
        college = College.objects.create(name='Leave Constraint College', code='LVCC1', city='Leave City', state='Leave State', is_active=True)
        student = user_factory(
            username='LEAVE_CONSTRAINT',
            registration_number='LEAVE_CONSTRAINT',
            password='LeaveConstraint123',
            role='student',
            college=college,
            is_password_changed=True,
        )

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                LeaveApplication.objects.create(
                    college=college,
                    student=student,
                    leave_type='personal',
                    start_date=date.today(),
                    end_date=date.today() - timedelta(days=1),
                    reason='Invalid range',
                )

    def test_hall_enforces_positive_capacity_at_db_level(self):
        with pytest.raises(IntegrityError):
            with transaction.atomic():
                Hall.objects.create(
                    hall_id='HALL-ZERO',
                    hall_name='Zero Capacity Hall',
                    capacity=0,
                    location='Campus',
                )

    def test_hall_slot_enforces_time_window_at_db_level(self):
        hall = Hall.objects.create(
            hall_id='HALL-OK',
            hall_name='Valid Hall',
            capacity=10,
            location='Campus',
        )

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                HallSlot.objects.create(
                    hall=hall,
                    start_time=time(14, 0),
                    end_time=time(13, 0),
                )

    def test_meal_feedback_enforces_rating_bounds_at_db_level(self, user_factory):
        college = College.objects.create(name='Meal Constraint College', code='MEAL1', city='Meal City', state='Meal State', is_active=True)
        chef = user_factory(
            username='CHEF_CONSTRAINT',
            registration_number='CHEF_CONSTRAINT',
            password='MealConstraint123',
            role='chef',
            college=college,
            is_password_changed=True,
        )
        student = user_factory(
            username='MEAL_STUDENT',
            registration_number='MEAL_STUDENT',
            password='MealConstraint123',
            role='student',
            college=college,
            is_password_changed=True,
        )
        meal = Meal.objects.create(
            college=college,
            meal_type='lunch',
            meal_date=date.today(),
            description='Constraint test meal',
            created_by=chef,
        )

        with pytest.raises(IntegrityError):
            with transaction.atomic():
                MealFeedback.objects.create(
                    college=college,
                    meal=meal,
                    user=student,
                    rating=6,
                    feedback_type='private',
                )