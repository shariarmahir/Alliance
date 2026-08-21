from fastapi import APIRouter, HTTPException, Request, Response, status

from app.core.deps import AdminDep, DbSession, clear_session_cookie, set_session_cookie
from app.core.rate_limit import check_rate_limit, client_key
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token, parse_session_claims
from app.schemas.session import AdminSession, LoginRequest, LoginResponse
from app.services.auth import verify_admin_credentials
from app.services.sessions import revoke_session

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
async def logout(request: Request, response: Response, db: DbSession) -> dict[str, bool]:
    """Ends the session server-side, not just in this browser.

    Clearing the cookie alone left the token valid for the rest of its 8 hours,
    so a copy of it kept full admin access after signing out. Recording the
    `sid` here is what actually ends the session, for every copy of that token
    at once.

    Deliberately not authenticated: a token that is expired, already revoked or
    otherwise unusable should still let someone sign out cleanly rather than
    meeting a 401 and leaving the cookie in place. Nothing is revealed either
    way — the response is the same whatever was presented.
    """
    claims = parse_session_claims(request.cookies.get(ADMIN_SESSION_COOKIE))
    if claims and claims.session_id and claims.expires_at:
        await revoke_session(db, claims.session_id, claims.expires_at)
        await db.commit()

    clear_session_cookie(response)
    return {"ok": True}


@router.get("/me", response_model=AdminSession)
async def me(session: AdminDep) -> AdminSession:
    return session
