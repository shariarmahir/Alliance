import hashlib
import hmac
import logging
import secrets
import time

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse

from app.config import settings
from app.core.deps import DbSession, SuperAdminDep
from app.integrations import gmail

logger = logging.getLogger("app.emails")

# Inbox access is a super-admin surface: it exposes the business's own mail.
router = APIRouter(prefix="/api/admin/emails", tags=["emails"])

STATE_TTL_SECONDS = 600


def _sign_state() -> str:
    """Signed, expiring state parameter.

    Without this the callback would accept any code an attacker could get the
    admin's browser to deliver — the classic OAuth CSRF.
    """
    nonce = secrets.token_urlsafe(16)
    issued = str(int(time.time()))
    payload = f"{nonce}.{issued}"
    signature = hmac.new(
        settings.session_secret.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()[:32]
    return f"{payload}.{signature}"


def _verify_state(state: str) -> bool:
    try:
        nonce, issued, signature = state.split(".")
    except (ValueError, AttributeError):
        return False
    expected = hmac.new(
        settings.session_secret.encode(), f"{nonce}.{issued}".encode(), hashlib.sha256
    ).hexdigest()[:32]
    if not hmac.compare_digest(signature, expected):
        return False
    return (time.time() - int(issued)) <= STATE_TTL_SECONDS


@router.get("/status")
async def connection_status(session: SuperAdminDep, db: DbSession):
    if not settings.gmail_configured:
        return {"configured": False, "connected": False, "email": None}
    record = await gmail.get_connection(db)
    return {
        "configured": True,
        "connected": record is not None,
        "email": record.email if record else None,
        "connectedAt": record.connected_at if record else None,
    }


@router.get("/oauth/start")
async def oauth_start(session: SuperAdminDep):
    try:
        return {"url": gmail.build_authorization_url(_sign_state())}
    except gmail.GmailNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/oauth/callback")
async def oauth_callback(db: DbSession, code: str = Query(...), state: str = Query("")):
    """Google redirects the browser here.

    Unauthenticated by necessity — the redirect carries no session cookie in a
    cross-origin context — so the signed state is what proves this flow was
    started by an admin on this backend.
    """
    if not _verify_state(state):
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state.")

    try:
        email = await gmail.exchange_code(db, code)
    except gmail.GmailNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Gmail OAuth exchange failed")
        raise HTTPException(status_code=502, detail="Gmail authorization failed.") from exc

    destination = f"{settings.public_site_url.rstrip('/')}/admin/emails"
    suffix = "?connected=1" if email else "?connected=0"
    return RedirectResponse(url=destination + suffix, status_code=status.HTTP_302_FOUND)


@router.delete("/connection", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect(session: SuperAdminDep, db: DbSession):
    if not await gmail.disconnect(db):
        raise HTTPException(status_code=404, detail="Gmail is not connected.")


@router.get("")
async def list_emails(session: SuperAdminDep, db: DbSession, limit: int = Query(25, ge=1, le=100)):
    """Returns an empty list when disconnected rather than erroring, so the
    admin screen renders its "connect" state instead of a failure."""
    try:
        return {"connected": True, "threads": await gmail.list_threads(db, limit)}
    except gmail.GmailNotConfigured:
        return {"connected": False, "threads": []}
    except Exception:
        logger.exception("Failed to list Gmail threads")
        raise HTTPException(status_code=502, detail="Could not reach Gmail.")


@router.get("/{thread_id}")
async def get_thread(thread_id: str, session: SuperAdminDep, db: DbSession):
    try:
        thread = await gmail.get_thread(db, thread_id)
    except gmail.GmailNotConfigured as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception:
        logger.exception("Failed to load Gmail thread %s", thread_id)
        raise HTTPException(status_code=502, detail="Could not reach Gmail.")
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found or Gmail not connected.")
    return thread
