from __future__ import annotations

from types import SimpleNamespace

import pytest
from django.core.exceptions import ValidationError

from core.security import AuditLogger, InputValidator, PermissionValidator, RateLimiter, safe_getattr


@pytest.mark.unit
class TestInputValidator:
    def test_validate_string_trims_value(self):
        assert InputValidator.validate_string("  value  ", "field") == "value"

    def test_validate_string_rejects_non_string(self):
        with pytest.raises(ValidationError):
            InputValidator.validate_string(123, "field")

    def test_validate_string_rejects_too_long(self):
        with pytest.raises(ValidationError):
            InputValidator.validate_string("x" * 6, "field", max_length=5)

    def test_validate_email_normalizes_to_lowercase(self):
        assert InputValidator.validate_email("USER@Example.COM") == "user@example.com"

    @pytest.mark.parametrize("email", ["", "bad-email", "a@b", "x" * 255 + "@example.com"])
    def test_validate_email_invalid_inputs(self, email):
        with pytest.raises(ValidationError):
            InputValidator.validate_email(email)

    def test_validate_phone_valid(self):
        assert InputValidator.validate_phone("+1 (987) 654-3210") == "+1 (987) 654-3210"

    @pytest.mark.parametrize("phone", ["abc123", "12", "+_invalid"])
    def test_validate_phone_invalid(self, phone):
        with pytest.raises(ValidationError):
            InputValidator.validate_phone(phone)

    def test_validate_hall_ticket_valid(self):
        assert InputValidator.validate_hall_ticket("ABC-123") == "ABC-123"

    @pytest.mark.parametrize("ticket", ["ab", "bad ticket", "bad#ticket"])
    def test_validate_hall_ticket_invalid(self, ticket):
        with pytest.raises(ValidationError):
            InputValidator.validate_hall_ticket(ticket)

    @pytest.mark.parametrize("value", ["2026-02-13", "2026-02-13T10:11:12"])
    def test_validate_date_format_valid(self, value):
        assert InputValidator.validate_date_format(value) == value

    @pytest.mark.parametrize("value", [123, "13/02/2026", "2026-2-3"])
    def test_validate_date_format_invalid(self, value):
        with pytest.raises(ValidationError):
            InputValidator.validate_date_format(value)

    def test_sanitize_html_escapes_markup(self):
        escaped = InputValidator.sanitize_html("<script>alert(1)</script>")
        assert escaped == "&lt;script&gt;alert(1)&lt;/script&gt;"

    def test_validate_status_accepts_allowed_status(self):
        assert InputValidator.validate_status("approved", ["approved", "pending"]) == "approved"

    def test_validate_status_rejects_unknown_status(self):
        with pytest.raises(ValidationError):
            InputValidator.validate_status("rejected", ["approved", "pending"])


@pytest.mark.unit
class TestPermissionValidator:
    def test_validate_ownership_for_allowed_role(self):
        assert PermissionValidator.validate_ownership(1, 2, "admin", ["admin", "super_admin"]) is True

    def test_validate_ownership_for_owner(self):
        assert PermissionValidator.validate_ownership(4, 4, "student", ["admin"]) is True

    def test_validate_ownership_for_non_owner_non_privileged_role(self):
        assert PermissionValidator.validate_ownership(4, 5, "student", ["admin"]) is False

    def test_validate_resource_access_requires_authenticated_user(self):
        user = SimpleNamespace(is_authenticated=False, is_superuser=False, role="student", id=1)
        resource = SimpleNamespace(student_id=1)
        assert PermissionValidator.validate_resource_access(user, resource) is False

    def test_validate_resource_access_superuser(self):
        user = SimpleNamespace(is_authenticated=True, is_superuser=True, role="student", id=1)
        resource = SimpleNamespace(student_id=999)
        assert PermissionValidator.validate_resource_access(user, resource) is True

    def test_validate_resource_access_by_required_role(self):
        user = SimpleNamespace(is_authenticated=True, is_superuser=False, role="admin", id=1)
        resource = SimpleNamespace(student_id=2)
        assert PermissionValidator.validate_resource_access(user, resource, required_role="admin") is True

    def test_validate_resource_access_by_ownership_student_id(self):
        user = SimpleNamespace(is_authenticated=True, is_superuser=False, role="student", id=10)
        resource = SimpleNamespace(student_id=10)
        assert PermissionValidator.validate_resource_access(user, resource) is True

    def test_validate_resource_access_denied_when_not_owner(self):
        user = SimpleNamespace(is_authenticated=True, is_superuser=False, role="student", id=10)
        resource = SimpleNamespace(student_id=20)
        assert PermissionValidator.validate_resource_access(user, resource) is False


@pytest.mark.unit
class TestRateLimiter:
    def test_is_rate_limited_blocks_after_limit(self, monkeypatch):
        current = [1000.0]

        def _fake_time():
            return current[0]

        monkeypatch.setattr("time.time", _fake_time)

        assert RateLimiter.is_rate_limited("user-1", max_requests=2, window_seconds=60) is False
        assert RateLimiter.is_rate_limited("user-1", max_requests=2, window_seconds=60) is False
        assert RateLimiter.is_rate_limited("user-1", max_requests=2, window_seconds=60) is True

    def test_is_rate_limited_window_expires(self, monkeypatch):
        current = [2000.0]

        def _fake_time():
            return current[0]

        monkeypatch.setattr("time.time", _fake_time)

        assert RateLimiter.is_rate_limited("user-2", max_requests=1, window_seconds=10) is False
        assert RateLimiter.is_rate_limited("user-2", max_requests=1, window_seconds=10) is True

        current[0] = 2011.0
        assert RateLimiter.is_rate_limited("user-2", max_requests=1, window_seconds=10) is False

    def test_eviction_keeps_dictionary_bounded(self, monkeypatch):
        monkeypatch.setattr("time.time", lambda: 5000.0)
        for idx in range(1002):
            RateLimiter.is_rate_limited(f"id-{idx}", max_requests=1, window_seconds=60)
        assert len(RateLimiter._request_counts) <= 1000


@pytest.mark.unit
class TestAuditLoggerAndSafeGetattr:
    def test_audit_logger_logs_info_or_warning(self, monkeypatch):
        calls = []

        def _capture(message, *args, **kwargs):
            calls.append(("INFO", message))

        monkeypatch.setattr(AuditLogger._logger, "info", _capture)

        AuditLogger.log_action(1, "create", "gate_pass", 10, details={"source": "api"}, success=True)
        AuditLogger.log_action(1, "delete", "gate_pass", 10, details=None, success=False)

        assert len(calls) == 2
        assert "AUDIT: CREATE gate_pass#10" in calls[0][1]
        assert "AUDIT: DELETE gate_pass#10" in calls[1][1]

    def test_safe_getattr_returns_value(self):
        obj = SimpleNamespace(name="abc")
        assert safe_getattr(obj, "name") == "abc"

    def test_safe_getattr_returns_default_when_attribute_raises(self):
        class Broken:
            @property
            def value(self):
                raise RuntimeError("boom")

        assert safe_getattr(Broken(), "value", default="fallback") == "fallback"
