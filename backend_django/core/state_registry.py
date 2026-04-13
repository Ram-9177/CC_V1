"""
Central transition registry — delegates to existing state_machine classes.

Call ``validate_transition`` before mutating state; keep existing domain validators
in place (non-replacement).
"""

from __future__ import annotations

from typing import Any, Type

from core.state_machine import ComplaintMachine, GatePassMachine, LeaveMachine

_REGISTRY: dict[str, Type[Any]] = {
    "gate_pass": GatePassMachine,
    "complaint": ComplaintMachine,
    "leave": LeaveMachine,
}


def validate_transition(resource_key: str, current: str, target: str) -> None:
    machine = _registry_get(resource_key)
    machine.validate(current, target)


def can_transition(resource_key: str, current: str, target: str) -> bool:
    machine = _registry_get(resource_key)
    fn = getattr(machine, "can_transition", None)
    if callable(fn):
        return bool(fn(current, target))
    transitions = getattr(machine, "TRANSITIONS", {})
    return target in transitions.get(current, [])


def _registry_get(resource_key: str):
    try:
        return _REGISTRY[resource_key]
    except KeyError as e:
        raise KeyError(f"Unknown state registry resource: {resource_key!r}") from e


def registered_resources() -> tuple[str, ...]:
    return tuple(sorted(_REGISTRY.keys()))
