from __future__ import annotations

import pytest

from utils.auth import decode_jwt_token, generate_jwt_token


@pytest.mark.unit
class TestJwtHelpers:
    def test_generate_and_decode_token_roundtrip(self):
        token = generate_jwt_token(user_id=101, expires_in=3600)
        payload = decode_jwt_token(token)

        assert payload is not None
        assert payload["user_id"] == 101
        assert "exp" in payload
        assert "iat" in payload

    def test_decode_expired_token_returns_none(self):
        token = generate_jwt_token(user_id=202, expires_in=-1)
        assert decode_jwt_token(token) is None

    @pytest.mark.parametrize("token", ["", "not-a-token", "abc.def", "abc.def.ghi"])
    def test_decode_invalid_token_returns_none(self, token):
        assert decode_jwt_token(token) is None
