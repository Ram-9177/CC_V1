"""Django app package marker.

Having an explicit package avoids namespace-package path duplication issues
when ASGI servers (e.g. Daphne) add `.` to `sys.path`.
"""

