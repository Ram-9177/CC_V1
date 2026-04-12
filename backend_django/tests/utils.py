from __future__ import annotations

from typing import Any

import requests


def auth_headers(access_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


def login_and_get_tokens(
    session: requests.Session,
    base_api_url: str,
    hall_ticket: str,
    password: str,
    timeout: int = 20,
) -> dict[str, Any]:
    response = session.post(
        f"{base_api_url}/login/",
        json={"hall_ticket": hall_ticket, "password": password},
        timeout=timeout,
    )
    response.raise_for_status()
    payload = response.json()
    if "tokens" not in payload:
        raise AssertionError("Login response missing 'tokens' object")
    if "access" not in payload["tokens"]:
        raise AssertionError("Login response missing access token")
    return payload["tokens"]


def assert_json_keys(payload: dict[str, Any], keys: list[str]) -> None:
    missing = [key for key in keys if key not in payload]
    assert not missing, f"Missing keys in response JSON: {missing}"
