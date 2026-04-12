from __future__ import annotations

from types import SimpleNamespace

import pytest

from core.permissions import (
    ROLE_ADMIN,
    ROLE_GATE_SECURITY,
    ROLE_STUDENT,
    ROLE_SUPER_ADMIN,
    AdminOrReadOnly,
    CanViewGatePasses,
    IsAdmin,
    IsGateSecurity,
    IsOwnerOrAdmin,
    IsReadOnly,
    IsStudent,
    IsStudentHR,
    PasswordChangeRequired,
    user_is_admin,
    user_is_security,
    user_is_staff,
    user_is_student,
    user_is_super_admin,
    user_is_warden,
)


class _ExistsResult:
    def __init__(self, value: bool):
        self._value = value

    def exists(self) -> bool:
        return self._value


class _GroupManager:
    def __init__(self, is_student_hr: bool):
        self._is_student_hr = is_student_hr

    def filter(self, **kwargs):
        return _ExistsResult(kwargs.get("name") == "Student_HR" and self._is_student_hr)


def _user(role: str | None, *, uid: int = 1, authenticated: bool = True, superuser: bool = False, is_password_changed: bool = True):
    return SimpleNamespace(
        id=uid,
        role=role,
        is_authenticated=authenticated,
        is_superuser=superuser,
        is_password_changed=is_password_changed,
        groups=_GroupManager(False),
    )


def _request(user, method: str = "GET", path: str = "/api/resource/"):
    return SimpleNamespace(user=user, method=method, path=path)


@pytest.mark.unit
class TestPermissionHelpers:
    @pytest.mark.parametrize("role", [ROLE_ADMIN, ROLE_SUPER_ADMIN])
    def test_user_is_admin_true_for_admin_roles(self, role):
        assert user_is_admin(_user(role)) is True

    def test_user_is_admin_true_for_superuser_flag(self):
        assert user_is_admin(_user(ROLE_STUDENT, superuser=True)) is True

    def test_user_is_admin_false_for_none(self):
        assert user_is_admin(None) is False

    def test_user_is_super_admin(self):
        assert user_is_super_admin(_user(ROLE_SUPER_ADMIN)) is True
        assert user_is_super_admin(_user(ROLE_ADMIN)) is False

    def test_user_is_staff(self):
        assert user_is_staff(_user("staff")) is True
        assert user_is_staff(_user(ROLE_STUDENT)) is False

    def test_user_is_student(self):
        assert user_is_student(_user(ROLE_STUDENT)) is True
        assert user_is_student(_user("warden")) is False

    def test_user_is_warden(self):
        assert user_is_warden(_user("warden")) is True
        assert user_is_warden(_user(ROLE_STUDENT)) is False

    def test_user_is_security(self):
        assert user_is_security(_user(ROLE_GATE_SECURITY)) is True
        assert user_is_security(_user(ROLE_STUDENT)) is False


@pytest.mark.unit
class TestPermissionClasses:
    def test_is_admin_permission(self):
        permission = IsAdmin()
        assert permission.has_permission(_request(_user(ROLE_ADMIN)), None) is True
        assert permission.has_permission(_request(_user(ROLE_STUDENT)), None) is False

    def test_is_student_permission(self):
        permission = IsStudent()
        assert permission.has_permission(_request(_user(ROLE_STUDENT)), None) is True
        assert permission.has_permission(_request(_user("warden")), None) is False

    def test_is_gate_security_permission(self):
        permission = IsGateSecurity()
        assert permission.has_permission(_request(_user(ROLE_GATE_SECURITY)), None) is True
        assert permission.has_permission(_request(_user(ROLE_STUDENT)), None) is False

    def test_is_read_only_permission(self):
        permission = IsReadOnly()
        assert permission.has_permission(_request(_user(ROLE_STUDENT), method="GET"), None) is True
        assert permission.has_permission(_request(_user(ROLE_STUDENT), method="POST"), None) is False

    def test_admin_or_read_only(self):
        permission = AdminOrReadOnly()
        assert permission.has_permission(_request(_user(ROLE_STUDENT), method="GET"), None) is True
        assert permission.has_permission(_request(_user(ROLE_STUDENT), method="PUT"), None) is False
        assert permission.has_permission(_request(_user(ROLE_ADMIN), method="PUT"), None) is True

    def test_is_owner_or_admin(self):
        permission = IsOwnerOrAdmin()
        admin_request = _request(_user(ROLE_ADMIN, uid=99))
        student_request = _request(_user(ROLE_STUDENT, uid=10))

        obj_owner = SimpleNamespace(student_id=10)
        obj_not_owner = SimpleNamespace(student_id=20)

        assert permission.has_object_permission(admin_request, None, obj_not_owner) is True
        assert permission.has_object_permission(student_request, None, obj_owner) is True
        assert permission.has_object_permission(student_request, None, obj_not_owner) is False

    def test_can_view_gate_passes(self):
        permission = CanViewGatePasses()
        gate_pass = SimpleNamespace(student_id=8)

        assert permission.has_object_permission(_request(_user(ROLE_ADMIN, uid=1)), None, gate_pass) is True
        assert permission.has_object_permission(_request(_user("gate_security", uid=1)), None, gate_pass) is True
        assert permission.has_object_permission(_request(_user(ROLE_STUDENT, uid=8)), None, gate_pass) is True
        assert permission.has_object_permission(_request(_user(ROLE_STUDENT, uid=9)), None, gate_pass) is False

    def test_is_student_hr_permission(self):
        permission = IsStudentHR()

        admin = _user(ROLE_ADMIN)
        assert permission.has_permission(_request(admin), None) is True

        student_hr_user = _user(ROLE_STUDENT)
        student_hr_user.groups = _GroupManager(True)
        assert permission.has_permission(_request(student_hr_user), None) is True

        regular_student = _user(ROLE_STUDENT)
        assert permission.has_permission(_request(regular_student), None) is False


@pytest.mark.unit
class TestPasswordChangeRequiredPermission:
    def test_allows_unauthenticated_requests(self):
        permission = PasswordChangeRequired()
        anon = _user(None, authenticated=False)
        assert permission.has_permission(_request(anon, path="/api/login/"), None) is True

    def test_allows_when_password_already_changed(self):
        permission = PasswordChangeRequired()
        user = _user(ROLE_STUDENT, is_password_changed=True)
        assert permission.has_permission(_request(user, path="/api/rooms/"), None) is True

    @pytest.mark.parametrize(
        ("path", "method", "expected"),
        [
            ("/api/auth/users/change_password/", "POST", True),
            ("/api/logout/", "POST", True),
            ("/api/token/refresh/", "POST", True),
            ("/api/profile/", "GET", True),
            ("/api/profile/", "PUT", False),
            ("/api/rooms/", "GET", False),
        ],
    )
    def test_restricts_access_until_password_change(self, path, method, expected):
        permission = PasswordChangeRequired()
        user = _user(ROLE_STUDENT, is_password_changed=False)
        assert permission.has_permission(_request(user, method=method, path=path), None) is expected
