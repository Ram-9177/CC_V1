from apps.gate_passes.models import GatePass


def get_active_gatepass(student):
    """Retrieve an active gatepass for preventing double creation."""
    return GatePass.objects.filter(
        student=student,
        status__in=["pending", "approved", "out"]
    ).first()


def get_gatepass_by_id(gatepass_id):
    """Retrieve gatepass by ID."""
    return GatePass.objects.filter(id=gatepass_id).first()
