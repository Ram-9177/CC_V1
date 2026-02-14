from __future__ import annotations

import pytest
from requests import Session

from tests.utils import assert_json_keys, auth_headers, login_and_get_tokens


@pytest.mark.django_db(transaction=True)
@pytest.mark.api
class TestAuthAndProfileAPIWithRequests:
    def test_login_success_returns_tokens_and_user_schema(
        self,
        requests_session: Session,
        live_api_base_url: str,
        user_factory,
    ):
        user_factory(
            username="API_AUTH_USER",
            registration_number="API_AUTH_USER",
            password="StrongPass123",
            role="student",
            is_password_changed=True,
        )

        response = requests_session.post(
            f"{live_api_base_url}/login/",
            json={"hall_ticket": "api_auth_user", "password": "StrongPass123"},
            timeout=20,
        )

        assert response.status_code == 200
        payload = response.json()
        assert_json_keys(payload, ["user", "tokens", "password_change_required"])
        assert_json_keys(payload["tokens"], ["access", "refresh"])
        assert payload["user"]["hall_ticket"] == "API_AUTH_USER"

    def test_login_invalid_credentials_returns_401(
        self,
        requests_session: Session,
        live_api_base_url: str,
        user_factory,
    ):
        user_factory(
            username="API_BAD_LOGIN",
            registration_number="API_BAD_LOGIN",
            password="CorrectPass123",
            role="student",
            is_password_changed=True,
        )

        response = requests_session.post(
            f"{live_api_base_url}/login/",
            json={"hall_ticket": "API_BAD_LOGIN", "password": "WrongPass"},
            timeout=20,
        )

        assert response.status_code == 401
        payload = response.json()
        assert "detail" in payload

    def test_profile_requires_authentication(self, requests_session: Session, live_api_base_url: str):
        response = requests_session.get(f"{live_api_base_url}/profile/", timeout=20)
        assert response.status_code == 401

    def test_profile_with_bearer_token_returns_user(
        self,
        requests_session: Session,
        live_api_base_url: str,
        user_factory,
    ):
        user_factory(
            username="API_PROFILE_USER",
            registration_number="API_PROFILE_USER",
            password="ProfilePass123",
            role="student",
            is_password_changed=True,
        )

        tokens = login_and_get_tokens(
            requests_session,
            live_api_base_url,
            hall_ticket="API_PROFILE_USER",
            password="ProfilePass123",
        )

        response = requests_session.get(
            f"{live_api_base_url}/profile/",
            headers=auth_headers(tokens["access"]),
            timeout=20,
        )

        assert response.status_code == 200
        payload = response.json()
        assert_json_keys(payload, ["id", "hall_ticket", "username", "role"])
        assert payload["hall_ticket"] == "API_PROFILE_USER"
