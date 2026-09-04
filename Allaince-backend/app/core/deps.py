from typing import Annotated

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.session_token import (
    ADMIN_SESSION_COOKIE,
    SESSION_TTL,
    SessionClaims,
    parse_session_claims,
)
from app.db import get_db
from app.schemas.session import IMPLIED_AREAS, AccessArea, AdminSession
from app.services.sessions import account_is_active, is_session_revoked

DbSession = Annotated[AsyncSession, Depends(get_db)]


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def _forbidden() -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


async def require_session_claims(request: Request, db: DbSession) -> SessionClaims:
    """Verifies the token, then checks it is still supposed to work.

    A signed, unexpired JWT is not on its own proof of a live session. Two
    things can have happened since it was minted, and neither leaves a trace in
    the token itself:

      - the holder signed out, which used to clear only the browser's cookie
        and left the token itself valid for the rest of its 8 hours;
      - the account was deleted or disabled, which used to remove the row while
        the token carried on authenticating reads *and writes*.

    Both are checked here rather than in `parse_session_claims` because both
    need the database, and that function also runs where there is none.
    """
    claims = parse_session_claims(request.cookies.get(ADMIN_SESSION_COOKIE))
    if claims is None:
        raise _unauthorized()
    if await is_session_revoked(db, claims.session_id):
        raise _unauthorized()
    if not await account_is_active(db, claims.session.employee_id):
        raise _unauthorized()
    return claims


async def require_admin(
    claims: Annotated[SessionClaims, Depends(require_session_claims)],
) -> AdminSession:
    """Any authenticated admin — super or sub.

    Backs products, stock, categories, hero images, and the self-service
    task/leave/report routes.
    """
    return claims.session


async def require_super_admin(
    session: Annotated[AdminSession, Depends(require_admin)],
) -> AdminSession:
    """Super admin only. 401 when unauthenticated, 403 when merely a sub."""
    if session.role != "super":
        raise _forbidden()
    return session


def require_area(area: AccessArea):
    """Super admin, or a sub-admin individually granted this access area.

    Mirrors requireAreaSession: delegable operations surfaces (quotations,
    orders, emails, contact-requests) rather than blanket super-only.
    """

    async def dependency(
        session: Annotated[AdminSession, Depends(require_admin)],
    ) -> AdminSession:
        if holds_area(session, area):
            return session
        raise _forbidden()

    return dependency


def holds_area(session: AdminSession, area: AccessArea) -> bool:
    """Whether this session reaches one area. Super admin passes everything.

    A broader grant covers the areas split out of it, so accounts that held
    "orders" before invoices and challans became separate keep reaching both.
    """
    if session.role == "super":
        return True
    granted = session.access_options or []
    if area in granted:
        return True
    return any(area in IMPLIED_AREAS.get(held, ()) for held in granted)


def require_any_area(*areas: AccessArea):
    """Any one of several grants is enough.

    For reads that several jobs legitimately need -- per-line balances are
    the case: whoever is about to invoice or dispatch needs the figures that
    stop them over-billing or over-shipping, and gating those behind a single
    area hides the guard rails from the person relying on them.
    """

    async def dependency(
        session: Annotated[AdminSession, Depends(require_admin)],
    ) -> AdminSession:
        if any(holds_area(session, area) for area in areas):
            return session
        raise _forbidden()

    return dependency


SessionClaimsDep = Annotated[SessionClaims, Depends(require_session_claims)]
AdminDep = Annotated[AdminSession, Depends(require_admin)]
SuperAdminDep = Annotated[AdminSession, Depends(require_super_admin)]


def set_session_cookie(response: Response, token: str) -> None:
    """Cross-origin sessions need SameSite=None; Secure in production —
    the frontend and API are different origins there."""
    response.set_cookie(
        key=ADMIN_SESSION_COOKIE,
        value=token,
        max_age=int(SESSION_TTL.total_seconds()),
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=ADMIN_SESSION_COOKIE,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        domain=settings.cookie_domain,
        path="/",
    )


def owns_or_super(session: AdminSession, owner_employee_id: str | None) -> bool:
    """Per-resource ownership check.

    RBAC alone is not enough for employee-scoped data: a sub-admin may update
    their own task but must get 403 on a colleague's, so callers compare
    session identity against the resource's owner rather than trusting role.
    """
    if session.role == "super":
        return True
    return bool(session.employee_id) and session.employee_id == owner_employee_id
