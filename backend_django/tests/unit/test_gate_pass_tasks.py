from __future__ import annotations

import pytest
from django.utils import timezone

from apps.gate_passes.models import GatePass
from apps.gate_passes.tasks import auto_expire_gate_passes
from apps.notifications.service import NotificationService


@pytest.mark.django_db
class TestGatePassTimeoutTasks:
    def test_auto_expire_gate_passes_reminds_and_expires_pending_passes(
        self,
        user_factory,
        gate_pass_factory,
        monkeypatch,
    ):
        student = user_factory(
            username="GP_TASK_STUDENT",
            registration_number="GP_TASK_STUDENT",
            password="GatePass123",
            role="student",
            student_type='hosteller',
            is_password_changed=True,
        )

        reminder_pass = gate_pass_factory(student=student, status='pending')
        expiry_pass = gate_pass_factory(student=student, status='pending')

        now = timezone.now()
        GatePass.objects.filter(id=reminder_pass.id).update(
            created_at=now - timezone.timedelta(hours=13),
            pending_reminded_at=None,
        )
        GatePass.objects.filter(id=expiry_pass.id).update(
            created_at=now - timezone.timedelta(hours=25),
            pending_reminded_at=None,
        )

        monkeypatch.setattr(NotificationService, 'send_to_roles', staticmethod(lambda *args, **kwargs: None))
        monkeypatch.setattr(NotificationService, 'send', staticmethod(lambda *args, **kwargs: None))

        processed_count = auto_expire_gate_passes()

        reminder_pass.refresh_from_db()
        expiry_pass.refresh_from_db()

        assert reminder_pass.status == 'pending'
        assert reminder_pass.pending_reminded_at is not None

        assert expiry_pass.status == 'expired'
        assert '24 hours' in (expiry_pass.approval_remarks or '')

        assert processed_count >= 2
