from __future__ import annotations

from types import SimpleNamespace

import pytest
from django.http import HttpResponse
from django.test import RequestFactory

from core.middleware import RequestLogMiddleware
from core.middleware.perf_logging import PerformanceLoggingMiddleware


@pytest.mark.integration
class TestMiddlewareIntegration:
    def test_performance_logs_slow_requests(self, monkeypatch):
        factory = RequestFactory()
        request = factory.get("/api/slow-endpoint/")
        request.user = SimpleNamespace(id=11, __str__=lambda self: "slow-user", is_authenticated=True)
        request.META["REMOTE_ADDR"] = "127.0.0.1"

        # Mock perf_counter to simulate > 2s delay
        # First call is start, second is end
        time_values = iter([10.0, 12.1])
        monkeypatch.setattr("core.middleware.perf_logging.time.perf_counter", lambda: next(time_values))

        logs = []
        # PerformanceLoggingMiddleware uses a specific logger
        monkeypatch.setattr("core.middleware.perf_logging.logger.warning", 
                           lambda msg, *args: logs.append(msg % args if args else msg))

        # We need settings.DEBUG=False to trigger the 2s warning logic in the if/else
        import django.conf
        monkeypatch.setattr(django.conf.settings, "DEBUG", False)

        middleware = PerformanceLoggingMiddleware(lambda req: HttpResponse("ok", status=200))
        response = middleware(request)

        assert response.status_code == 200
        assert any("Slow Request" in msg for msg in logs)

    def test_request_log_access_denied_events(self, monkeypatch):
        factory = RequestFactory()
        request = factory.get("/api/private/")
        request.user = SimpleNamespace(id=22, __str__=lambda self: "blocked-user", is_authenticated=True)
        request.META["REMOTE_ADDR"] = "10.0.0.1"

        logs = []
        monkeypatch.setattr("core.middleware.logger.log", lambda level, message: logs.append(message))

        middleware = RequestLogMiddleware(lambda req: HttpResponse("forbidden", status=403))
        response = middleware(request)

        assert response.status_code == 403
        assert any("Access Denied" in msg for msg in logs)
