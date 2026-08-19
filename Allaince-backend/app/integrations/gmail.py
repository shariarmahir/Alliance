import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.integrations.crypto import decrypt, encrypt
from app.models import GmailToken

logger = logging.getLogger("app.gmail")

# Read-only. Sending goes through Resend, so the inbox integration never needs
# permission to send as the user.
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


class GmailNotConfigured(RuntimeError):
    """OAuth client credentials are absent from the environment."""


def _require_config() -> None:
    if not settings.gmail_configured:
        raise GmailNotConfigured(
            "Gmail is not configured. Set GOOGLE_OAUTH_CLIENT_ID, "
            "GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI."
        )


def _client_config() -> dict:
    return {
        "web": {
            "client_id": settings.google_oauth_client_id,
            "client_secret": settings.google_oauth_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_oauth_redirect_uri],
        }
    }


def build_authorization_url(state: str) -> str:
    _require_config()
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = settings.google_oauth_redirect_uri
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        # Force a refresh token even if the account already granted consent.
        prompt="consent",
        state=state,
    )
    return url


async def exchange_code(db: AsyncSession, code: str) -> str | None:
    """Trades the authorization code for a refresh token and stores it
    encrypted. Returns the connected account's email."""
    _require_config()
    from google_auth_oauthlib.flow import Flow

    flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
    flow.redirect_uri = settings.google_oauth_redirect_uri
    flow.fetch_token(code=code)
    credentials = flow.credentials

    if not credentials.refresh_token:
        logger.warning("Google returned no refresh token; cannot persist the connection.")
        return None

    email = None
    try:
        from googleapiclient.discovery import build

        profile = build("gmail", "v1", credentials=credentials).users().getProfile(userId="me").execute()
        email = profile.get("emailAddress")
    except Exception:
        logger.exception("Connected, but could not read the Gmail profile.")

    existing = (await db.execute(select(GmailToken))).scalars().first()
    if existing is None:
        db.add(
            GmailToken(
                id=1,
                encrypted_refresh_token=encrypt(credentials.refresh_token),
                email=email,
                connected_at=datetime.now(timezone.utc),
            )
        )
    else:
        existing.encrypted_refresh_token = encrypt(credentials.refresh_token)
        existing.email = email
        existing.connected_at = datetime.now(timezone.utc)
    await db.commit()
    return email


async def get_connection(db: AsyncSession) -> GmailToken | None:
    return (await db.execute(select(GmailToken))).scalars().first()


async def _credentials(db: AsyncSession):
    """Rebuilds credentials from the stored refresh token.

    A decrypt failure (typically a rotated secret) is treated as "not
    connected" rather than an error, matching the frontend's behaviour.
    """
    _require_config()
    record = await get_connection(db)
    if record is None:
        return None

    refresh_token = decrypt(record.encrypted_refresh_token)
    if refresh_token is None:
        logger.warning("Stored Gmail token could not be decrypted; treating as disconnected.")
        return None

    from google.oauth2.credentials import Credentials

    return Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_oauth_client_id,
        client_secret=settings.google_oauth_client_secret,
        scopes=SCOPES,
    )


async def disconnect(db: AsyncSession) -> bool:
    record = await get_connection(db)
    if record is None:
        return False
    await db.delete(record)
    await db.commit()
    return True


async def list_threads(db: AsyncSession, limit: int = 25) -> list[dict]:
    credentials = await _credentials(db)
    if credentials is None:
        return []

    from googleapiclient.discovery import build

    service = build("gmail", "v1", credentials=credentials)
    listed = (
        service.users()
        .messages()
        .list(userId="me", maxResults=limit, labelIds=["INBOX"])
        .execute()
    )

    threads: list[dict] = []
    for entry in listed.get("messages", []):
        message = (
            service.users()
            .messages()
            .get(userId="me", id=entry["id"], format="metadata",
                 metadataHeaders=["From", "Subject", "Date"])
            .execute()
        )
        headers = {h["name"]: h["value"] for h in message.get("payload", {}).get("headers", [])}
        threads.append(
            {
                "id": message.get("id"),
                "threadId": message.get("threadId"),
                "from": headers.get("From", ""),
                "subject": headers.get("Subject", "(no subject)"),
                "preview": message.get("snippet", ""),
                "receivedAt": headers.get("Date", ""),
                "unread": "UNREAD" in (message.get("labelIds") or []),
            }
        )
    return threads


async def get_thread(db: AsyncSession, thread_id: str) -> dict | None:
    credentials = await _credentials(db)
    if credentials is None:
        return None

    from googleapiclient.discovery import build

    service = build("gmail", "v1", credentials=credentials)
    thread = service.users().threads().get(userId="me", id=thread_id, format="full").execute()

    messages = []
    for message in thread.get("messages", []):
        headers = {h["name"]: h["value"] for h in message.get("payload", {}).get("headers", [])}
        messages.append(
            {
                "id": message.get("id"),
                "from": headers.get("From", ""),
                "to": headers.get("To", ""),
                "subject": headers.get("Subject", "(no subject)"),
                "receivedAt": headers.get("Date", ""),
                "body": _extract_body(message.get("payload", {})),
            }
        )
    return {"id": thread.get("id"), "messages": messages}


def _extract_body(payload: dict) -> str:
    """Walks the MIME tree for the first text part, preferring plain text."""
    import base64 as b64

    def decode(data: str) -> str:
        return b64.urlsafe_b64decode(data.encode()).decode("utf-8", errors="replace")

    if payload.get("body", {}).get("data"):
        return decode(payload["body"]["data"])

    parts = payload.get("parts") or []
    for mime in ("text/plain", "text/html"):
        for part in parts:
            if part.get("mimeType") == mime and part.get("body", {}).get("data"):
                return decode(part["body"]["data"])
    for part in parts:
        nested = _extract_body(part)
        if nested:
            return nested
    return ""
