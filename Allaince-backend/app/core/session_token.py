import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings
from app.schemas.session import ACCESS_AREAS, AdminSession

ADMIN_SESSION_COOKIE = "autolink_admin_session"

SESSION_TTL = timedelta(hours=8)
ALGORITHM = "HS256"


@dataclass(frozen=True)
class SessionClaims:
    """A verified token's identity plus the bookkeeping fields revocation needs.

    `session_id` names this one sign-in so it can be revoked individually, and
    `expires_at` says when the denylist row for it stops mattering.
    """

    session: AdminSession
    session_id: str | None
    expires_at: datetime | None


def create_session_token(session: AdminSession) -> str:
    now = datetime.now(timezone.utc)
    payload: dict = {
        "role": session.role,
        "name": session.name,
        "email": session.email,
        # Identifies this sign-in specifically. Without it a token is
        # indistinguishable from every other token that user ever held, so
        # logout could only be enforced by invalidating all of them at once.
        "sid": uuid.uuid4().hex,
        "iat": now,
        "exp": now + SESSION_TTL,
    }
    if session.employee_id is not None:
        payload["employeeId"] = session.employee_id
    if session.access_options is not None:
        payload["accessOptions"] = session.access_options
    return jwt.encode(payload, settings.session_secret, algorithm=ALGORITHM)


def parse_session_claims(raw: str | None) -> SessionClaims | None:
    """Signature-and-expiry check only.

    Deliberately does not consult the revocation list: this runs in contexts
    with no database (token extraction, tests), so callers that can reach the
    database use `require_admin`, which layers the revocation and account
    checks on top. Missing, tampered, malformed and expired tokens all return
    None — callers treat the four identically.
    """
    if not raw:
        return None
    try:
        payload = jwt.decode(raw, settings.session_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None

    if payload.get("role") not in ("super", "sub"):
        return None
    if not isinstance(payload.get("name"), str) or not isinstance(payload.get("email"), str):
        return None

    access_options = payload.get("accessOptions")
    # Derived from the AccessArea literal rather than repeated here: this
    # filter silently drops anything it does not recognise, so a hardcoded
    # copy that falls behind revokes a real grant with no error anywhere.
    if isinstance(access_options, list):
        access_options = [a for a in access_options if a in ACCESS_AREAS]
    else:
        access_options = None

    employee_id = payload.get("employeeId")
    session = AdminSession(
        role=payload["role"],
        name=payload["name"],
        email=payload["email"],
        employee_id=employee_id if isinstance(employee_id, str) else None,
        access_options=access_options,
    )

    sid = payload.get("sid")
    exp = payload.get("exp")
    return SessionClaims(
        session=session,
        session_id=sid if isinstance(sid, str) else None,
        expires_at=(
            datetime.fromtimestamp(exp, tz=timezone.utc) if isinstance(exp, (int, float)) else None
        ),
    )


def parse_admin_session(raw: str | None) -> AdminSession | None:
    """Identity only, without the revocation check — see `parse_session_claims`."""
    claims = parse_session_claims(raw)
    return claims.session if claims else None
