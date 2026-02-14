from __future__ import annotations

from types import SimpleNamespace

import pytest
from django.http import HttpResponse
from django.test import RequestFactory

from core.middleware import RequestLogMiddleware


@pytest.mark.integration
class TestRequestLogMiddleware:
    def test_logs_slow_requests(self, monkeypatch):
        factory = RequestFactory()
        request = factory.get("/api/slow-endpoint/")
        request.user = SimpleNamespace(id=11, __str__=lambda self: "slow-user")
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        time_values = iter([10.0, 10.9])
        monkeypatch.setattr("core.middleware.time.time", lambda: next(time_values))

        logs = []
        monkeypatch.setattr("core.middleware.logger.warning", lambda message: logs.append(message))

        middleware = RequestLogMiddleware(lambda req: HttpResponse("ok", status=200))
        response = middleware(request)

        assert response.status_code == 200
        assert any("Slow Request" in msg for msg in logs)

    def test_logs_access_denied_events(self, monkeypatch):
        factory = RequestFactory()
        request = factory.get("/api/private/")
        request.user = SimpleNamespace(id=22, __str__=lambda self: "blocked-user")
        request.META["REMOTE_ADDR"] = "10.0.0.1"

        time_values = iter([20.0, 20.1])
        monkeypatch.setattr("core.middleware.time.time", lambda: next(time_values))

        logs = []
        monkeypatch.setattr("core.middleware.logger.warning", lambda message: logs.append(message))

        middleware = RequestLogMiddleware(lambda req: HttpResponse("forbidden", status=403))
        response = middleware(request)

        assert response.status_code == 403
        assert any("Access Denied" in msg for msg in logs)
