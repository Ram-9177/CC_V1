import pytest

from apps.colleges.models import College
from apps.gate_passes.models import GateLocation
from apps.notifications.models import Notification



def _create_college(suffix: str) -> College:
    return College.objects.create(
        name=f"Test College {suffix}",
        code=f"TC{suffix}",
        city="City",
        state="State",
    )


@pytest.mark.django_db
class TestGateLocationManagement:
    def test_security_head_can_crud_gate_locations_with_college_scope(self, api_client, user_factory):
        college_a = _create_college("A")
        college_b = _create_college("B")

        security_head_a = user_factory(username="SECHEAD_A", role="security_head", college=college_a)
        warden_a = user_factory(username="WARDEN_A", role="warden", college=college_a)

        GateLocation.objects.create(name="Back Gate", code="back_gate", college=college_a)
        GateLocation.objects.create(name="Other Gate", code="other_gate", college=college_b)

        api_client.force_authenticate(user=security_head_a)
        create_resp = api_client.post(
            "/api/gate-passes/locations/",
            {"name": "Main Gate", "code": "main_gate"},
            format="json",
        )
        assert create_resp.status_code == 201

        list_resp = api_client.get("/api/gate-passes/locations/")
        assert list_resp.status_code == 200
        rows = list_resp.data if isinstance(list_resp.data, list) else list_resp.data.get("results", list_resp.data)
        names = {row["name"] for row in rows}
        assert "Main Gate" in names
        assert "Back Gate" in names
        assert "Other Gate" not in names

        api_client.force_authenticate(user=warden_a)
        denied_resp = api_client.post(
            "/api/gate-passes/locations/",
            {"name": "Side Gate"},
            format="json",
        )
        assert denied_resp.status_code == 403


@pytest.mark.django_db
class TestSecurityHeadUserManagement:
    def test_security_head_can_edit_gate_security_core_fields(self, api_client, user_factory):
        college = _create_college("C")
        security_head = user_factory(username="SECHEAD_EDIT", role="security_head", college=college)
        gate_security = user_factory(
            username="SEC_EDIT_TARGET",
            role="gate_security",
            college=college,
            first_name="Old",
        )

        api_client.force_authenticate(user=security_head)
        response = api_client.patch(
            f"/api/auth/users/{gate_security.id}/",
            {"first_name": "Updated"},
            format="json",
        )

        assert response.status_code == 200
        gate_security.refresh_from_db()
        assert gate_security.first_name == "Updated"


@pytest.mark.django_db
class TestGateApprovalSecurityFanout:
    def test_approve_notifies_gate_security_and_security_head_in_same_college(
        self,
        api_client,
        user_factory,
        gate_pass_factory,
    ):
        college_a = _create_college("D")
        college_b = _create_college("E")

        student_a = user_factory(username="STUDENT_A_GP", role="student", college=college_a)
        warden_a = user_factory(username="WARDEN_A_GP", role="warden", college=college_a)

        security_a1 = user_factory(username="SEC_A1_GP", role="gate_security", college=college_a)
        security_a2 = user_factory(username="SEC_A2_GP", role="gate_security", college=college_a)
        security_head_a = user_factory(username="SECH_A_GP", role="security_head", college=college_a)

        user_factory(username="SEC_B1_GP", role="gate_security", college=college_b)
        user_factory(username="SECH_B_GP", role="security_head", college=college_b)

        gate_pass = gate_pass_factory(student=student_a, status="pending", college=college_a)

        api_client.force_authenticate(user=warden_a)
        response = api_client.post(
            f"/api/gate-passes/{gate_pass.id}/approve/",
            {"remarks": "Approved for testing"},
            format="json",
        )
        assert response.status_code == 200

        recipients = set(
            Notification.objects.filter(
                title="Gate Pass Approved",
                recipient__role__in=["gate_security", "security_head"],
            ).values_list("recipient_id", flat=True)
        )

        assert recipients == {security_a1.id, security_a2.id, security_head_a.id}

    def test_mark_informed_approve_notifies_same_college_security_roles(
        self,
        api_client,
        user_factory,
        gate_pass_factory,
    ):
        college_a = _create_college("F")
        college_b = _create_college("G")

        student_a = user_factory(username="STUDENT_A_MI", role="student", college=college_a)
        warden_a = user_factory(username="WARDEN_A_MI", role="warden", college=college_a)

        security_a = user_factory(username="SEC_A_MI", role="gate_security", college=college_a)
        security_head_a = user_factory(username="SECH_A_MI", role="security_head", college=college_a)

        user_factory(username="SEC_B_MI", role="gate_security", college=college_b)
        user_factory(username="SECH_B_MI", role="security_head", college=college_b)

        gate_pass = gate_pass_factory(student=student_a, status="pending", college=college_a)

        api_client.force_authenticate(user=warden_a)
        response = api_client.post(
            f"/api/gate-passes/{gate_pass.id}/mark_informed/",
            {"approve": True},
            format="json",
        )
        assert response.status_code == 200

        recipients = set(
            Notification.objects.filter(
                title="Gate Pass Approved",
                action_url="/gate-scans",
                recipient__role__in=["gate_security", "security_head"],
            ).values_list("recipient_id", flat=True)
        )

        assert recipients == {security_a.id, security_head_a.id}


@pytest.mark.django_db
class TestGateAssignmentValidation:
    def test_gate_assignment_validation_on_user_create(self, api_client, user_factory):
        college_a = _create_college("H")
        college_b = _create_college("I")
        admin_a = user_factory(username="ADMIN_ASSIGN", role="admin", college=college_a)

        gate_a = GateLocation.objects.create(name="Main Gate", code="main_gate", college=college_a)
        gate_b = GateLocation.objects.create(name="Back Gate", code="back_gate", college=college_b)

        api_client.force_authenticate(user=admin_a)

        valid_payload = {
            "username": "SEC_NEW_VALID",
            "email": "sec.new.valid@example.com",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "first_name": "Sec",
            "last_name": "Valid",
            "phone_number": "9876543210",
            "role": "gate_security",
            "assigned_gate_locations": [str(gate_a.id)],
        }
        valid_resp = api_client.post("/api/auth/users/", valid_payload, format="json")
        assert valid_resp.status_code == 201

        cross_college_payload = {
            "username": "SEC_NEW_BADCOL",
            "email": "sec.new.badcol@example.com",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "first_name": "Sec",
            "last_name": "BadCol",
            "phone_number": "9876543211",
            "role": "gate_security",
            "assigned_gate_locations": [str(gate_b.id)],
        }
        cross_college_resp = api_client.post("/api/auth/users/", cross_college_payload, format="json")
        assert cross_college_resp.status_code == 400
        cross_college_details = cross_college_resp.data.get("details", {}) if isinstance(cross_college_resp.data, dict) else {}
        assert "assigned_gate_locations" in str(cross_college_resp.data) or "assigned_gate_locations" in cross_college_details

        invalid_role_payload = {
            "username": "STAFF_WITH_GATE",
            "email": "staff.with.gate@example.com",
            "password": "Password123!",
            "password_confirm": "Password123!",
            "first_name": "Staff",
            "last_name": "Gate",
            "phone_number": "9876543212",
            "role": "staff",
            "assigned_gate_locations": [str(gate_a.id)],
        }
        invalid_role_resp = api_client.post("/api/auth/users/", invalid_role_payload, format="json")
        assert invalid_role_resp.status_code == 400
        invalid_role_details = invalid_role_resp.data.get("details", {}) if isinstance(invalid_role_resp.data, dict) else {}
        assert "assigned_gate_locations" in str(invalid_role_resp.data) or "assigned_gate_locations" in invalid_role_details
