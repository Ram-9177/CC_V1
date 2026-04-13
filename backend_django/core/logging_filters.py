"""Structured logging filters for CampusCore.

Injects `college_id` and `user_id` into every log record so that
production logs can be filtered/searched by tenant and user.

The values are pulled from the current thread-local request (set by
Django's request/response cycle). In Celery workers there is no request,
so the fields default to '-'.
"""

import logging
import threading

_local = threading.local()


def set_log_context(
    user_id=None,
    college_id=None,
    trace_id=None,
    module=None,
    action=None,
    status=None,
):
    """Called by middleware to set context for the current request thread."""
    _local.user_id = user_id or '-'
    _local.college_id = college_id or '-'
    _local.trace_id = trace_id or '-'
    _local.log_module = module or '-'
    _local.action = action if action is not None else '-'
    _local.status = status if status is not None else '-'


def clear_log_context():
    """Called at the end of a request to clean up thread-local state."""
    _local.user_id = '-'
    _local.college_id = '-'
    _local.trace_id = '-'
    _local.log_module = '-'
    _local.action = '-'
    _local.status = '-'


class RequestContextFilter(logging.Filter):
    """Adds college_id, tenant_id, user_id, trace_id, path, action, status to records."""

    def filter(self, record):
        record.user_id = getattr(_local, 'user_id', '-')
        record.college_id = getattr(_local, 'college_id', '-')
        record.tenant_id = record.college_id
        record.trace_id = getattr(_local, 'trace_id', '-')
        record.log_module = getattr(_local, 'log_module', '-')
        record.action = getattr(_local, 'action', '-')
        record.status = getattr(_local, 'status', '-')
        return True
