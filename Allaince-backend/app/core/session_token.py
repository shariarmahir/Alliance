from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings
from app.schemas.session import AdminSession

ADMIN_SESSION_COOKIE = "autolink_admin_session"

SESSION_TTL = timedelta(hours=8)
ALGORITHM = "HS256"


def create_session_token(session: AdminSession) -> str:
    now = datetime.now(timezone.utc)
    payload: dict = {
        "role": session.role,
        "name": session.name,
        "email": session.email,
        "iat": now,
        "exp": now + SESSION_TTL,
    }
    if session.employee_id is not None:
        payload["employeeId"] = session.employee_id
    if session.access_options is not None:
        payload["accessOptions"] = session.access_options
    return jwt.encode(payload, settings.session_secret, algorithm=ALGORITHM)


def parse_admin_session(raw: str | None) -> AdminSession | None:
    """Missing, tampered, malformed and expired tokens all return None —
    callers treat the four identically, same as the frontend did."""
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
    valid_areas = {"quotations", "orders", "emails", "contact-requests"}
    if isinstance(access_options, list):
        access_options = [a for a in access_options if a in valid_areas]
    else:
        access_options = None

    employee_id = payload.get("employeeId")
    return AdminSession(
        role=payload["role"],
        name=payload["name"],
        email=payload["email"],
        employee_id=employee_id if isinstance(employee_id, str) else None,
        access_options=access_options,
    )
