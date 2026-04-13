"""Optional idempotency for DRF write actions via Idempotency-Key header."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response

from core.models import IdempotencyKey
from core.utils.idempotency_payload import hash_request_body


class IdempotentWriteMixin:
    """
    When ``Idempotency-Key`` is sent on POST/PUT/PATCH, replays the stored
    response (including HTTP status) for duplicate requests.

    If the same key is reused with a **different** request body, returns HTTP 409.

    No header → identical behavior to the base ViewSet.
    """

    idempotency_ttl_seconds: int = 86400

    def _idem_user_id(self, request):
        if request.user.is_authenticated:
            return request.user.pk
        return "anon"

    def _idem_conflict_response(self):
        return Response(
            {
                "success": False,
                "code": "IDEMPOTENCY_KEY_CONFLICT",
                "message": (
                    "This Idempotency-Key was already used with a different request body."
                ),
                "details": {},
            },
            status=status.HTTP_409_CONFLICT,
        )

    def create(self, request, *args, **kwargs):
        key = request.headers.get("Idempotency-Key")
        if not key or not request.user.is_authenticated:
            return super().create(request, *args, **kwargs)
        body_hash = hash_request_body(request)
        replay = IdempotencyKey.objects.replay_for_write(
            key,
            self._idem_user_id(request),
            self.idempotency_ttl_seconds,
            request_body_sha256=body_hash,
        )
        if replay == "conflict":
            return self._idem_conflict_response()
        if replay is not None:
            body, status_code = replay
            return Response(body, status=status_code)
        response = super().create(request, *args, **kwargs)
        if 200 <= response.status_code < 300:
            IdempotencyKey.objects.store_write(
                key,
                self._idem_user_id(request),
                response.data,
                response.status_code,
                self.idempotency_ttl_seconds,
                request_body_sha256=body_hash,
            )
        return response

    def update(self, request, *args, **kwargs):
        key = request.headers.get("Idempotency-Key")
        if not key or not request.user.is_authenticated:
            return super().update(request, *args, **kwargs)
        body_hash = hash_request_body(request)
        replay = IdempotencyKey.objects.replay_for_write(
            key,
            self._idem_user_id(request),
            self.idempotency_ttl_seconds,
            request_body_sha256=body_hash,
        )
        if replay == "conflict":
            return self._idem_conflict_response()
        if replay is not None:
            body, status_code = replay
            return Response(body, status=status_code)
        response = super().update(request, *args, **kwargs)
        if 200 <= response.status_code < 300:
            IdempotencyKey.objects.store_write(
                key,
                self._idem_user_id(request),
                response.data,
                response.status_code,
                self.idempotency_ttl_seconds,
                request_body_sha256=body_hash,
            )
        return response

    def partial_update(self, request, *args, **kwargs):
        key = request.headers.get("Idempotency-Key")
        if not key or not request.user.is_authenticated:
            return super().partial_update(request, *args, **kwargs)
        body_hash = hash_request_body(request)
        replay = IdempotencyKey.objects.replay_for_write(
            key,
            self._idem_user_id(request),
            self.idempotency_ttl_seconds,
            request_body_sha256=body_hash,
        )
        if replay == "conflict":
            return self._idem_conflict_response()
        if replay is not None:
            body, status_code = replay
            return Response(body, status=status_code)
        response = super().partial_update(request, *args, **kwargs)
        if 200 <= response.status_code < 300:
            IdempotencyKey.objects.store_write(
                key,
                self._idem_user_id(request),
                response.data,
                response.status_code,
                self.idempotency_ttl_seconds,
                request_body_sha256=body_hash,
            )
        return response
