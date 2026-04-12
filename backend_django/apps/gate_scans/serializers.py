"""Gate scans serializers — re-export from canonical location."""

# GateScan model lives in apps.gate_passes.  Import the serializer from there
# so all consumers get the same, richer representation (student room, photo, etc.)
from apps.gate_passes.serializers import GateScanSerializer  # noqa: F401
