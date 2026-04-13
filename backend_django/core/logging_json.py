"""Opt-in JSON log formatter for centralized log platforms (Datadog, ELK, etc.)."""

from __future__ import annotations

from pythonjsonlogger import jsonlogger


class EnterpriseJsonFormatter(jsonlogger.JsonFormatter):
    """
    One JSON object per line with standard fields.

    Enable via ``LOG_JSON_FORMAT=true`` in settings (see ``hostelconnect.settings.base``).
    """

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record.setdefault("level", record.levelname)
        log_record.setdefault("logger", record.name)
        log_record.setdefault("module", record.module)

        trace_id = getattr(record, "trace_id", None)
        user_id = getattr(record, "user_id", None)
        college_id = getattr(record, "college_id", None)
        tenant_id = getattr(record, "tenant_id", None)
        path = getattr(record, "log_module", None)
        action = getattr(record, "action", None)
        status = getattr(record, "status", None)

        if trace_id is not None:
            log_record["trace_id"] = trace_id
        if user_id is not None:
            log_record["user_id"] = user_id
        if tenant_id is not None:
            log_record["tenant_id"] = tenant_id
        elif college_id is not None:
            log_record["tenant_id"] = college_id
        if college_id is not None:
            log_record["college_id"] = college_id
        if path is not None:
            log_record["path"] = path
        if action is not None:
            log_record["action"] = action
        if status is not None:
            log_record["status"] = status
