"""Status normalization utilities.

Maps legacy/variant status strings to the canonical set.
Old values are never removed from DB — this is a read-time normalizer only.

Canonical statuses
------------------
pending | approved | rejected | in_progress | completed | cancelled
"""

_NORMALIZE_MAP = {
    # gate pass / leave variants
    'PENDING_APPROVAL': 'pending',
    'APPROVED': 'approved',
    'REJECTED': 'rejected',
    'ACTIVE': 'in_progress',
    'COMPLETED': 'completed',
    'CANCELLED': 'cancelled',
    # complaint variants
    'open': 'pending',
    'in_progress': 'in_progress',
    'resolved': 'completed',
    # sport booking variants
    'confirmed': 'approved',
    'attended': 'completed',
    'no_show': 'cancelled',
    # gate pass movement
    'outside': 'in_progress',
    'returned': 'completed',
    'late_return': 'completed',
    'used': 'in_progress',
    'expired': 'cancelled',
}

CANONICAL_STATUSES = frozenset([
    'pending', 'approved', 'rejected', 'in_progress', 'completed', 'cancelled',
])


def normalize_status(value: str) -> str:
    """Return the canonical status for *value*, or *value* unchanged if unknown."""
    if not value:
        return value
    return _NORMALIZE_MAP.get(value, value)
