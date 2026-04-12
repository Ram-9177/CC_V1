from __future__ import annotations

import pytest
from importlib import import_module

from django.conf import settings
from rest_framework import status
from rest_framework.test import APIClient


@pytest.mark.django_db
@pytest.mark.integration
class TestAuthFlowIntegration:
    def test_login_profile_and_refresh_flow(self, user_factory):
        user_factory(
            username="STU-INTEGRATION",
            password="secret123",
            registration_number="STU-INTEGRATION",
            role="student",
            is_password_changed=True,
        )

        client = APIClient()

        login_response = client.post(
            "/api/login/",
            {"hall_ticket": "stu-integration", "password": "secret123"},
            format="json",
        )

        assert login_response.status_code == status.HTTP_200_OK
        assert "tokens" in login_response.data
        assert "access" in login_response.data["tokens"]
        assert "refresh" in login_response.data["tokens"]
        assert login_response.data["user"]["hall_ticket"] == "STU-INTEGRATION"
        assert login_response.data["password_change_required"] is False
        assert "refresh_token" in login_response.cookies

        access = login_response.data["tokens"]["access"]
        profile_response = client.get("/api/profile/", HTTP_AUTHORIZATION=f"Bearer {access}")
        assert profile_response.status_code == status.HTTP_200_OK
        assert profile_response.data["hall_ticket"] == "STU-INTEGRATION"

        refresh = login_response.data["tokens"]["refresh"]
        refresh_response = client.post(
            "/api/token/refresh/",
            HTTP_COOKIE=f"refresh_token={refresh}"
        )
        assert refresh_response.status_code == status.HTTP_200_OK
        assert "access_token" in (refresh_response.cookies.keys() if hasattr(refresh_response, 'cookies') else []) or "detail" in refresh_response.data

    def test_login_with_invalid_credentials_returns_401(self, user_factory):
        user_factory(username="STU-BADLOGIN", password="rightpass", role="student", is_password_changed=True)

        client = APIClient()
        response = client.post(
            "/api/login/",
            {"hall_ticket": "STU-BADLOGIN", "password": "wrongpass"},
            format="json",
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
@pytest.mark.integration
class TestSessionHandlingIntegration:
    def test_signed_cookie_session_roundtrip(self):
        engine = import_module(settings.SESSION_ENGINE)
        session_store = engine.SessionStore()
        session_store["qa_key"] = "qa_value"
        session_store.save()

        loaded = engine.SessionStore(session_key=session_store.session_key)
        assert loaded.get("qa_key") == "qa_value"
