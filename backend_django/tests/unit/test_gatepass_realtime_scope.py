import pytest

from apps.colleges.models import College
from apps.gate_passes import signals as gatepass_signals
from apps.gate_passes.models import GatePass, GateScan


class _DummyChannelLayer:
    def __init__(self):
        self.calls = []

    async def group_send(self, group, payload):
        self.calls.append((group, payload))



def _create_college(suffix: str) -> College:
    return College.objects.create(
        name=f"Realtime College {suffix}",
        code=f"RTC{suffix}",
        city="City",
        state="State",
    )


@pytest.mark.django_db
class TestGatePassRealtimeCollegeScope:
    def test_gatepass_status_broadcast_targets_college_scoped_security_group(
        self,
        monkeypatch,
        user_factory,
        gate_pass_factory,
    ):
        college = _create_college("A")
        student = user_factory(username="RT_STUDENT_A", role="student", college=college)
        approver = user_factory(username="RT_WARDEN_A", role="warden", college=college)

        gate_pass = gate_pass_factory(
            student=student,
            status="approved",
            college=college,
            approved_by=approver,
            approval_remarks="approved",
        )
        gate_pass._previous_status = "pending"

        layer = _DummyChannelLayer()
        monkeypatch.setattr(gatepass_signals, "get_channel_layer", lambda: layer)

        gatepass_signals.broadcast_gatepass_realtime(
            sender=GatePass,
            instance=gate_pass,
            created=False,
        )

        groups = [group for group, _ in layer.calls]
        assert f"gatepass_security_college_{college.id}" in groups
        assert "gatepass_security" not in groups

    def test_gate_scan_broadcast_targets_college_scoped_security_group(
        self,
        monkeypatch,
        user_factory,
    ):
        college = _create_college("B")
        student = user_factory(username="RT_STUDENT_B", role="student", college=college)

        scan = GateScan.objects.create(
            student=student,
            direction="out",
            qr_code="RT:SCAN",
            location="Main Gate",
            college=college,
        )

        layer = _DummyChannelLayer()
        monkeypatch.setattr(gatepass_signals, "get_channel_layer", lambda: layer)

        gatepass_signals.broadcast_gate_scan_realtime(
            sender=GateScan,
            instance=scan,
            created=True,
        )

        groups = [group for group, _ in layer.calls]
        assert f"gatepass_security_college_{college.id}" in groups
        assert "gatepass_security" not in groups
