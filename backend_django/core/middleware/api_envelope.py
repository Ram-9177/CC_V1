"""Wrap JSON API responses in a standard envelope when the client opts in."""

from __future__ import annotations

import json
import logging

from django.http import HttpResponse, StreamingHttpResponse
from django.utils.deprecation import MiddlewareMixin

from core.utils.api_envelope import should_wrap, wrap_json_body

logger = logging.getLogger(__name__)


class ApiEnvelopeMiddleware(MiddlewareMixin):
    """
    If ``X-CampusCore-Envelope: 1`` or ``?_envelope=1``, JSON responses are wrapped as::

        { "success", "message", "data", "error", "meta" }
    """

    def process_response(self, request, response):
        if not should_wrap(request):
            return response
        if isinstance(response, StreamingHttpResponse):
            return response
        if not getattr(response, "content", None):
            return response
        ct = response.get("Content-Type", "") or ""
        if "application/json" not in ct.lower():
            return response
        try:
            raw = response.content.decode(response.charset or "utf-8")
            if not raw.strip():
                return response
            parsed = json.loads(raw)
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            logger.debug("ApiEnvelopeMiddleware: skip non-JSON body: %s", e)
            return response

        wrapped = wrap_json_body(parsed, status_code=response.status_code)
        out = json.dumps(wrapped, default=str)
        new = HttpResponse(
            out,
            status=response.status_code,
            content_type="application/json",
        )
        for key, value in response.items():
            if key.lower() == "content-length":
                continue
            new[key] = value
        return new
