from fastapi import APIRouter, HTTPException, Request, Response, status

from app.core.deps import AdminDep, DbSession, clear_session_cookie, set_session_cookie
from app.core.rate_limit import check_rate_limit, client_key
from app.core.session_token import create_session_token
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
