"""Digital Card QR parsing and user resolution helpers."""

from __future__ import annotations

import uuid
import hmac
import hashlib
from dataclasses import dataclass
from typing import Optional

from django.conf import settings

from apps.auth.models import User


QR_PREFIX = "dcqr"
QR_VERSION = "v1"


class DigitalQRValidationError(ValueError):
    """Raised when a Digital Card QR payload is invalid."""


@dataclass
class DigitalQRIdentity:
    """Resolved identity extracted from a Digital Card QR payload."""

    user_id: uuid.UUID


def build_digital_qr_payload(user_id: uuid.UUID | str) -> str:
    """Build the canonical payload string for Digital Card QR."""
    user_uuid = user_id if isinstance(user_id, uuid.UUID) else uuid.UUID(str(user_id))
    return f"{QR_PREFIX}:{QR_VERSION}:{str(user_uuid)}"


def _signature_for(payload_without_signature: str) -> str:
    secret = settings.SECRET_KEY.encode("utf-8")
    digest = hmac.new(secret, payload_without_signature.encode("utf-8"), hashlib.sha256).hexdigest()
    return digest[:24]


def build_signed_digital_qr_payload(user_id: uuid.UUID | str) -> str:
    """Build signed Digital Card QR payload: dcqr:v1:<user_uuid>:<signature>."""
    base_payload = build_digital_qr_payload(user_id)
    signature = _signature_for(base_payload)
    return f"{base_payload}:{signature}"


def parse_digital_qr_payload(raw_payload: str) -> DigitalQRIdentity:
    """Parse and validate a canonical signed Digital Card QR payload."""
    payload = (raw_payload or "").strip()
    parts = payload.split(":")
    if len(parts) != 4:
        raise DigitalQRValidationError("Invalid digital QR format. Expected dcqr:v1:<user_uuid>:<signature>.")

    prefix, version, user_part, signature = parts
    if prefix.lower() != QR_PREFIX or version.lower() != QR_VERSION:
        raise DigitalQRValidationError("Unsupported digital QR payload version.")

    try:
        user_uuid = uuid.UUID(user_part)
    except ValueError as exc:
        raise DigitalQRValidationError("Invalid digital QR user id.") from exc

    expected_signature = _signature_for(f"{prefix}:{version}:{str(user_uuid)}")
    if not hmac.compare_digest(signature, expected_signature):
        raise DigitalQRValidationError("Invalid digital QR signature.")

    return DigitalQRIdentity(user_id=user_uuid)


def resolve_user_from_digital_qr(
    raw_payload: str,
    *,
    require_active: bool = True,
    strict: Optional[bool] = None,
) -> User:
    """Resolve a user from Digital Card QR with optional strict enforcement."""
    strict_mode = settings.DIGITAL_QR_STRICT_ONLY if strict is None else strict
    if strict_mode:
        identity = parse_digital_qr_payload(raw_payload)
    else:
        try:
            identity = parse_digital_qr_payload(raw_payload)
        except DigitalQRValidationError as exc:
            raise DigitalQRValidationError("Invalid QR. Please scan Digital Card QR.") from exc

    user = User.objects.filter(id=identity.user_id).first()
    if not user:
        raise DigitalQRValidationError("No user found for the scanned QR.")
    if require_active and not user.is_active:
        raise DigitalQRValidationError("User is inactive. Access denied.")
    return user

