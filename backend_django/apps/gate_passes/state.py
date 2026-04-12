"""
Gatepass Domain State Machine Validation
Migrated from core.state_machine for modular monolith boundary enforcement.
"""

class GatePassState:
    
    VALID_TRANSITIONS = {
        "draft": ["pending", "cancelled"],
        "pending": ["approved", "rejected", "cancelled"],
        "approved": ["out", "expired", "cancelled"],
        "out": ["in"],
        "in": ["completed"],
        "late_return": ["completed"],
        "rejected": [],
        "completed": [],
        "expired": [],
        "cancelled": []
    }

    @classmethod
    def can_transition(cls, current: str, new: str) -> bool:
        """Check if transition is valid without raising an error."""
        return new in cls.VALID_TRANSITIONS.get(current, [])

    @classmethod
    def validate_transition(cls, current: str, new: str):
        """Strict guard layer: Raise exception on invalid transitions."""
        if not cls.can_transition(current, new):
            raise Exception(f"Invalid transition constraint breach: Cannot move {current} → {new}")
