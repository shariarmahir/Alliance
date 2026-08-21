from fastapi import APIRouter, HTTPException, Request, Response, status

from app.core.deps import AdminDep, DbSession, clear_session_cookie, set_session_cookie
from app.core.rate_limit import check_rate_limit, client_key
from app.core.session_token import (
    ADMIN_SESSION_COOKIE,
    create_session_token,
    parse_admin_session,
)
from app.schemas.session import AdminSession, LoginRequest, LoginResponse
from app.services.auth import verify_admin_credentials

router = APIRouter(prefix="/api/admin", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, request: Request, response: Response, db: DbSession):
    # Throttled per IP: bcrypt makes each attempt costly, but unlimited
    # attempts still make offline-speed guessing an online option.
    limit = await check_rate_limit(client_key(request, "login"), limit=10, window_seconds=600)
    if not limit.ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please wait and try again.",
            headers={"Retry-After": str(limit.retry_after_seconds)},
        )

    session = await verify_admin_credentials(db, payload.email, payload.password)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password."
        )

    set_session_cookie(response, create_session_token(session))
    # Both roles land on /admin; the page branches on role.
    return LoginResponse(session=session, redirect_to="/admin")


@router.post("/logout")
async def logout(response: Response) -> dict[str, bool]:
    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=AdminSession)
async def me(session: AdminDep) -> AdminSession:
    return session


@router.get("/whoami")
async def whoami(request: Request) -> dict:
    """Unauthenticated diagnostic: reports what the browser actually sent.

    Temporary. Added while tracing admin writes that returned 401 from a
    session that rendered pages fine, where every server-side check passed and
    the open question was whether the cookie reached the API at all. Reveals
    no secrets — only whether the cookie arrived and, if so, whether it
    verifies.
    """
    raw = request.cookies.get(ADMIN_SESSION_COOKIE)
    parsed = parse_admin_session(raw)
    return {
        "cookieNames": sorted(request.cookies.keys()),
        "sessionCookiePresent": raw is not None,
        "sessionCookieLength": len(raw) if raw else 0,
        "tokenVerifies": parsed is not None,
        "email": parsed.email if parsed else None,
        "origin": request.headers.get("origin"),
    }
