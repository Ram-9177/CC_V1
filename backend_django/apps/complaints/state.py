"""
Complaint Domain State Machine Validation
Migrated from core.state_machine for modular monolith boundary enforcement.
"""

class ComplaintState:
    
    VALID_TRANSITIONS = {
        "pending": ["in_progress", "rejected"],
        "in_progress": ["resolved", "rejected"],
        "resolved": ["closed", "pending"],  # Pending -> Re-opened if student is not satisfied.
        "rejected": [],
        "closed": []
    }

    @classmethod
    def can_transition(cls, current: str, new: str) -> bool:
        """Check if transition is valid without raising an error."""
        return new in cls.VALID_TRANSITIONS.get(current, [])

    @classmethod
    def validate_transition(cls, current: str, new: str):
        """Strict guard layer: Raise exception on invalid transitions."""
        if not cls.can_transition(current, new):
            raise Exception(f"Invalid transition constraint breach: Cannot move Complaint {current} → {new}")
