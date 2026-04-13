"""Attach trace_id and logging context for each request."""

from __future__ import annotations

import uuid

from core.logging_filters import set_log_context


class TraceContextMiddleware:
    """Set ``request.trace_id`` and thread-local fields for structured logs."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.META.get("HTTP_X_REQUEST_ID") or request.META.get(
            "HTTP_X_TRACE_ID"
        )
        if incoming and isinstance(incoming, str) and incoming.strip():
            trace_id = incoming.strip()[:128]
        else:
            trace_id = str(uuid.uuid4())
        request.trace_id = trace_id

        user = getattr(request, "user", None)
        uid = getattr(user, "pk", None) if getattr(user, "is_authenticated", False) else None
        college_id = getattr(user, "college_id", None) if getattr(user, "is_authenticated", False) else None

        set_log_context(
            user_id=str(uid) if uid is not None else None,
            college_id=str(college_id) if college_id is not None else None,
            trace_id=trace_id,
            module=request.path,
        )

        try:
            return self.get_response(request)
        finally:
            from core.logging_filters import clear_log_context

            clear_log_context()
