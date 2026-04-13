"""Canonical request-body hashing for idempotency conflict detection."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from django.http import HttpRequest
from rest_framework.request import Request


def hash_raw_body(raw: bytes) -> str:
    """SHA-256 hex digest of the raw request body (empty body allowed)."""
    return hashlib.sha256(raw or b"").hexdigest()


def hash_request_body(request: HttpRequest | Request) -> str:
    """Hash JSON or raw body; stable for the bytes Django/DRF expose."""
    if hasattr(request, "body"):
        return hash_raw_body(request.body or b"")
    post = getattr(request, "POST", None)
    if post is not None:
        try:
            return hash_raw_body(
                json.dumps(dict(post), sort_keys=True, default=str).encode("utf-8")
            )
        except Exception:
            return hash_raw_body(b"")
    return hash_raw_body(b"")
