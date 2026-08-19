from typing import Annotated

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.session_token import ADMIN_SESSION_COOKIE, SESSION_TTL, parse_admin_session
from app.db import get_db
from app.schemas.session import AccessArea, AdminSession

DbSession = Annotated[AsyncSession, Depends(get_db)]


def _unauthorized() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def _forbidden() -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


async def require_admin(request: Request) -> AdminSession:
    """Any authenticated admin — super or sub.

    Backs products, stock, categories, hero images, and the self-service
    task/leave/report routes.
    """
    session = parse_admin_session(request.cookies.get(ADMIN_SESSION_COOKIE))
    if session is None:
        raise _unauthorized()
    return session


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
        if session.role == "super":
            return session
        if area in (session.access_options or []):
            return session
        raise _forbidden()

    return dependency


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
