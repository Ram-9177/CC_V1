"""Append-only system event logging and per-channel delivery rows (additive)."""

from __future__ import annotations

from typing import Any

from core.models import SystemEvent, SystemEventDelivery, SystemEventLog


def log_system_event(
    event: SystemEvent,
    action: str,
    detail: dict[str, Any] | None = None,
) -> None:
    SystemEventLog.objects.create(
        system_event=event,
        action=action,
        detail=detail or {},
    )


def record_channel_delivery(
    event: SystemEvent,
    channel: str,
    *,
    ok: bool,
    error_message: str = '',
    tenant_id: str | None = None,
) -> None:
    status = (
        SystemEventDelivery.STATUS_SENT
        if ok
        else SystemEventDelivery.STATUS_FAILED
    )
    SystemEventDelivery.objects.create(
        system_event=event,
        channel=channel,
        status=status,
        attempts=1,
        last_error=(error_message or '')[:2000],
        tenant_id=tenant_id,
    )
