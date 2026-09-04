import hashlib
import hmac
import logging
import secrets
import time

from email.utils import parseaddr

from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.core.deps import DbSession, SuperAdminDep
from app.integrations import email as email_integration
from app.integrations import gmail
from app.integrations import imap_mail

logger = logging.getLogger("app.emails")


def _address_only(value: str) -> str:
    """The bare address out of a From header.

    Headers arrive as 'Ada Lovelace <ada@example.com>'; Resend needs the
    address on its own. Returns "" when there is nothing parseable, which the
    caller turns into a 409 rather than sending into the void.
    """
    return parseaddr(value)[1].strip()

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
    provider = settings.mailbox_provider

    if provider == "imap":
        # IMAP is configured entirely on the server, so there is no
        # per-admin authorisation step: if the credentials work the mailbox
        # is connected, and if they do not that is a server misconfiguration
        # to report rather than a button for the admin to press.
        try:
            email_address = await imap_mail.check_connection()
            return {
                "configured": True,
                "connected": True,
                "provider": "imap",
                "email": email_address,
            }
        except Exception as exc:
            logger.exception("IMAP connection check failed")
            return {
                "configured": True,
                "connected": False,
                "provider": "imap",
                "email": settings.imap_username,
                "error": str(exc),
            }

    if provider == "gmail":
        record = await gmail.get_connection(db)
        return {
            "configured": True,
            "connected": record is not None,
            "provider": "gmail",
            "email": record.email if record else None,
            "connectedAt": record.connected_at if record else None,
        }

    return {"configured": False, "connected": False, "provider": "none", "email": None}


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
    if settings.mailbox_provider == "imap":
        try:
            return {"connected": True, "threads": await imap_mail.list_threads(limit)}
        except imap_mail.ImapNotConfigured:
            return {"connected": False, "threads": []}
        except Exception:
            logger.exception("Failed to list IMAP messages")
            raise HTTPException(status_code=502, detail="Could not reach the mail server.")

    try:
        return {"connected": True, "threads": await gmail.list_threads(db, limit)}
    except gmail.GmailNotConfigured:
        return {"connected": False, "threads": []}
    except Exception:
        logger.exception("Failed to list Gmail threads")
        raise HTTPException(status_code=502, detail="Could not reach Gmail.")


@router.get("/{thread_id}")
async def get_thread(thread_id: str, session: SuperAdminDep, db: DbSession):
    if settings.mailbox_provider == "imap":
        try:
            thread = await imap_mail.get_thread(thread_id)
        except imap_mail.ImapNotConfigured as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception:
            logger.exception("Failed to load IMAP message %s", thread_id)
            raise HTTPException(status_code=502, detail="Could not reach the mail server.")
        if thread is None:
            raise HTTPException(status_code=404, detail="Message not found.")
        return thread

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


class ReplyIn(BaseModel):
    """A reply typed on the Shared inbox screen."""

    body: str = Field(min_length=1, max_length=20000)


@router.post("/{thread_id}/reply", status_code=status.HTTP_202_ACCEPTED)
async def reply_to_thread(
    thread_id: str, payload: ReplyIn, session: SuperAdminDep, db: DbSession
):
    """Answers a message in the shared mailbox.

    Reading and sending are different systems here: mail arrives over IMAP
    (Namecheap Private Email) and goes out through Resend, which is what the
    domain's SPF and DKIM records authorise. So a reply is not "IMAP write" --
    the mailbox stays strictly read-only -- it is a new message addressed and
    threaded to look like a reply.

    The recipient is taken from the stored message rather than the request:
    accepting an arbitrary address here would turn an authenticated admin
    screen into an open relay for the business's own domain.
    """
    if settings.mailbox_provider == "imap":
        try:
            thread = await imap_mail.get_thread(thread_id)
        except imap_mail.ImapNotConfigured as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception:
            logger.exception("Failed to load IMAP message %s for reply", thread_id)
            raise HTTPException(status_code=502, detail="Could not reach the mail server.")
    else:
        try:
            thread = await gmail.get_thread(db, thread_id)
        except gmail.GmailNotConfigured as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception:
            logger.exception("Failed to load Gmail thread %s for reply", thread_id)
            raise HTTPException(status_code=502, detail="Could not reach Gmail.")

    if thread is None:
        raise HTTPException(status_code=404, detail="Message not found.")

    messages = thread.get("messages") or []
    if not messages:
        raise HTTPException(status_code=409, detail="This message has nothing to reply to.")
    original = messages[-1]

    recipient = _address_only(thread.get("replyTo") or original.get("from") or "")
    if not recipient:
        raise HTTPException(
            status_code=409, detail="This message carries no address to reply to."
        )

    subject = original.get("subject") or "(no subject)"
    if not subject.lower().startswith("re:"):
        subject = f"Re: {subject}"

    # In-Reply-To/References are what file the answer under the original in
    # the customer's client. Omitted rather than faked when the source message
    # had no Message-ID: a wrong reference breaks threading more visibly than
    # no reference at all.
    headers: dict[str, str] = {}
    message_id = thread.get("messageId")
    if message_id:
        references = " ".join(filter(None, [thread.get("references", ""), message_id]))
        headers["In-Reply-To"] = message_id
        headers["References"] = references

    sent = await email_integration.send_email(
        recipient,
        subject,
        email_integration.reply_html(payload.body, original),
        headers=headers or None,
    )
    if not sent:
        # Say why, rather than reporting a reply the customer will never
        # receive. A spent daily quota and a bad API key need different
        # actions from whoever is reading this.
        failure = email_integration.last_failure()
        raise HTTPException(
            status_code=failure.status if failure else 502,
            detail=str(failure) if failure else "Could not send the reply.",
        )

    logger.info("%s replied to %s (%s)", session.email, recipient, thread_id)
    return {"sent": True, "to": recipient, "subject": subject}
