"""Opt-in API response envelope helpers.

Enabled only when the client sends ``X-CampusCore-Envelope: 1`` or ``?_envelope=1``.
Default responses are unchanged.
"""

from __future__ import annotations

from typing import Any, Mapping

ENVELOPE_HEADER = "HTTP_X_CAMPUSCORE_ENVELOPE"
ENVELOPE_QUERY = "envelope"


def should_wrap(request) -> bool:
    """Return True if this request opts into the standard envelope."""
    if getattr(request, "META", {}).get(ENVELOPE_HEADER) == "1":
        return True
    q = getattr(request, "GET", None)
    if q is not None and q.get(ENVELOPE_QUERY) == "1":
        return True
    return False


def envelope_success(
    data: Any = None,
    message: str = "OK",
    meta: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "success": True,
        "message": message,
        "data": data,
        "error": None,
        "meta": dict(meta) if meta else {},
    }


def envelope_error(
    message: str,
    error: Any = None,
    meta: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "success": False,
        "message": message,
        "data": None,
        "error": error,
        "meta": dict(meta) if meta else {},
    }


def wrap_json_body(body: Any, *, status_code: int) -> dict[str, Any]:
    """
    Wrap a parsed JSON body into the standard envelope.

    - 2xx: entire body becomes ``data``; message from body ``message`` if str, else OK.
    - non-2xx: body becomes ``error`` when dict, else {"detail": body}; message inferred.
    """
    if 200 <= status_code < 300:
        msg = "OK"
        if isinstance(body, dict) and isinstance(body.get("message"), str):
            msg = body["message"]
        return envelope_success(data=body, message=msg)

    err: Any = body
    msg = "Request failed"
    if isinstance(body, dict):
        if isinstance(body.get("message"), str):
            msg = body["message"]
        elif isinstance(body.get("detail"), str):
            msg = body["detail"]
        err = body
    else:
        err = {"detail": body}
    return envelope_error(message=msg, error=err)
