from __future__ import annotations

from types import SimpleNamespace

import pytest
from django.core.exceptions import PermissionDenied, ValidationError
from rest_framework import status
from rest_framework.exceptions import NotAuthenticated, PermissionDenied as DRFPermissionDenied

from core.errors import (
    APIError,
    ConflictAPIError,
    NotFoundAPIError,
    PermissionAPIError,
    ValidationAPIError,
    api_error_response,
    api_success_response,
    format_validation_error,
    standardized_exception_handler,
)
from core.exceptions import custom_exception_handler


@pytest.mark.unit
class TestApiErrorTypes:
    def test_api_error_defaults(self):
        error = APIError("boom")
        assert error.message == "boom"
        assert error.code == "API_ERROR"
        assert error.status_code == 400
        assert error.details == {}

    def test_specific_api_error_subclasses(self):
        validation_error = ValidationAPIError("invalid", details={"field": "required"})
        assert validation_error.code == "VALIDATION_ERROR"
        assert validation_error.status_code == 400

        permission_error = PermissionAPIError()
        assert permission_error.code == "PERMISSION_DENIED"
        assert permission_error.status_code == 403

        not_found_error = NotFoundAPIError(resource_type="Gate pass")
        assert not_found_error.code == "NOT_FOUND"
        assert not_found_error.status_code == 404

        conflict_error = ConflictAPIError("conflict")
        assert conflict_error.code == "CONFLICT"
        assert conflict_error.status_code == 409


@pytest.mark.unit
class TestValidationFormatting:
    def test_format_validation_error_with_error_dict(self):
        err = ValidationError({"field": ["invalid"]})
        formatted = format_validation_error(err)
        assert "field" in formatted

    def test_format_validation_error_with_error_list(self):
        err = ValidationError(["bad payload"])
        formatted = format_validation_error(err)
        assert "non_field_errors" in formatted


@pytest.mark.unit
class TestStandardizedExceptionHandler:
    def _context(self):
        user = SimpleNamespace(id=7)
        request = SimpleNamespace(path="/api/sample/", method="POST", user=user)
        return {"request": request, "view": None}

    def test_handles_custom_api_error(self):
        response = standardized_exception_handler(PermissionAPIError(), self._context())
        assert response.status_code == 403
        assert response.data["success"] is False
        assert response.data["code"] == "PERMISSION_DENIED"

    def test_handles_drf_exception(self):
        response = standardized_exception_handler(NotAuthenticated("Missing token"), self._context())
        assert response.status_code == 401
        assert response.data["success"] is False
        assert response.data["code"] == "API_ERROR"

    def test_handles_django_validation_error(self):
        response = standardized_exception_handler(ValidationError({"field": ["required"]}), self._context())
        assert response.status_code == 400
        assert response.data["code"] == "VALIDATION_ERROR"

    def test_handles_django_permission_denied(self):
        response = standardized_exception_handler(PermissionDenied("forbidden"), self._context())
        assert response.status_code == 403
        assert response.data["code"] == "API_ERROR"

    def test_handles_unexpected_exception(self):
        response = standardized_exception_handler(RuntimeError("boom"), self._context())
        assert response.status_code == 500
        assert response.data["code"] == "INTERNAL_ERROR"
        assert response.data["success"] is False

    def test_api_response_helpers(self):
        error_resp = api_error_response("bad", code="BAD_INPUT", details={"k": "v"}, status_code=422)
        assert error_resp.status_code == 422
        assert error_resp.data["success"] is False
        assert error_resp.data["code"] == "BAD_INPUT"

        success_resp = api_success_response(data={"id": 1}, message="ok", code="DONE", status_code=201)
        assert success_resp.status_code == 201
        assert success_resp.data["success"] is True
        assert success_resp.data["code"] == "DONE"


@pytest.mark.unit
class TestCustomExceptionHandler:
    def _context(self):
        request = SimpleNamespace(path="/api/test/", method="GET", user=SimpleNamespace(id=1))
        return {"request": request}

    def test_adds_error_code_for_drf_permission_denied(self):
        response = custom_exception_handler(DRFPermissionDenied("denied"), self._context())
        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert response.data["error_code"] == "PERMISSION_DENIED"

    def test_handles_non_drf_exception_with_internal_error_shape(self):
        response = custom_exception_handler(RuntimeError("crash"), self._context())
        assert response.status_code == 500
        assert response.data["error_code"] == "INTERNAL_SERVER_ERROR"
        assert "error_id" in response.data
        assert len(response.data["error_id"]) == 8
