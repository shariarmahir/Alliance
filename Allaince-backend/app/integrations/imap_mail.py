"""The shared mailbox over IMAP, for hosts that offer no OAuth.

Namecheap Private Email -- which is what auto-bd.com's MX records point at --
has no OAuth, so the mailbox is read with its own password. That password
lives in the environment and never leaves the server: it is not stored in the
database, never returned by an endpoint and never entered through the admin
UI, because it grants full access to the mailbox rather than the read-only
scope a Gmail token carries.

Every function returns the same shapes as integrations/gmail.py, so the
router and the admin screen do not care which provider is behind them.

Read-only by design. Nothing here sets flags, moves or deletes mail -- the
connection is opened with readonly=True so a bug cannot mark someone's inbox
as read. Sending still goes through Resend.

The stdlib imaplib is blocking, so every call is run in a worker thread: the
API is async, and blocking its event loop on a mail server's round trip would
stall every other request in the process.
"""

import asyncio
import email
import imaplib
import logging
from email.header import decode_header, make_header
from email.message import Message

from app.config import settings

logger = logging.getLogger("app.imap")

# A whole inbox can be tens of thousands of messages, and each fetch is a
# round trip. The screen shows a recent-mail list, so it reads the newest
# slice rather than everything.
MAX_LIMIT = 100


class ImapNotConfigured(RuntimeError):
    """IMAP settings are absent from the environment."""


def _require_config() -> None:
    if not settings.imap_configured:
        raise ImapNotConfigured(
            "IMAP is not configured. Set IMAP_HOST, IMAP_USERNAME and IMAP_PASSWORD."
        )


def _decode(value: str | None) -> str:
    """A MIME-encoded header as readable text.

    Subjects arrive as =?UTF-8?B?...?= and would otherwise render as that
    literal string. Malformed encodings fall back to the raw value: an
    ugly subject beats a failed inbox load.
    """
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except Exception:
        return value


def _connect() -> imaplib.IMAP4_SSL:
    _require_config()
    client = imaplib.IMAP4_SSL(settings.imap_host, settings.imap_port)
    client.login(settings.imap_username, settings.imap_password)
    return client


def _body(message: Message) -> str:
    """The first readable text part, preferring plain over HTML.

    Attachments are skipped: this walks for something to display, and a PDF
    decoded as text is noise.
    """
    if not message.is_multipart():
        payload = message.get_payload(decode=True)
        charset = message.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="replace") if payload else ""

    html_fallback = ""
    for part in message.walk():
        if part.get_content_maintype() == "multipart":
            continue
        if "attachment" in (part.get("Content-Disposition") or "").lower():
            continue

        payload = part.get_payload(decode=True)
        if not payload:
            continue
        charset = part.get_content_charset() or "utf-8"
        text = payload.decode(charset, errors="replace")

        if part.get_content_type() == "text/plain":
            return text
        if part.get_content_type() == "text/html" and not html_fallback:
            html_fallback = text
    return html_fallback


def _preview(message: Message, length: int = 140) -> str:
    """A one-line snippet, matching the Gmail integration's `preview`."""
    import re

    text = _body(message)
    # HTML-only mail would otherwise preview as a wall of markup.
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:length]


def _summarise(uid: str, message: Message, unread: bool) -> dict:
    subject = _decode(message.get("Subject")) or "(no subject)"
    return {
        # The UID doubles as the thread id: IMAP has no thread concept, so a
        # message is its own conversation as far as this screen is concerned.
        "id": uid,
        "threadId": uid,
        "from": _decode(message.get("From")),
        "subject": subject,
        "preview": _preview(message),
        "receivedAt": message.get("Date", ""),
        "unread": unread,
    }


def _list_threads_sync(limit: int) -> list[dict]:
    client = _connect()
    try:
        # readonly: opening a mailbox read-write would clear the \Seen flag
        # state as messages are fetched, quietly marking the business's mail
        # as read just because an admin opened the dashboard.
        client.select("INBOX", readonly=True)

        status, data = client.search(None, "ALL")
        if status != "OK":
            return []
        uids = data[0].split()
        if not uids:
            return []

        unseen: set[bytes] = set()
        status, unseen_data = client.search(None, "UNSEEN")
        if status == "OK" and unseen_data and unseen_data[0]:
            unseen = set(unseen_data[0].split())

        threads: list[dict] = []
        # Newest first, which is the order the screen displays.
        for uid in reversed(uids[-limit:]):
            status, fetched = client.fetch(uid, "(RFC822)")
            if status != "OK" or not fetched or not isinstance(fetched[0], tuple):
                continue
            message = email.message_from_bytes(fetched[0][1])
            threads.append(_summarise(uid.decode(), message, uid in unseen))
        return threads
    finally:
        _close(client)


def _get_thread_sync(uid: str) -> dict | None:
    client = _connect()
    try:
        client.select("INBOX", readonly=True)
        status, fetched = client.fetch(uid.encode(), "(RFC822)")
        if status != "OK" or not fetched or not isinstance(fetched[0], tuple):
            return None

        message = email.message_from_bytes(fetched[0][1])
        return {
            "id": uid,
            "messages": [
                {
                    "id": uid,
                    "from": _decode(message.get("From")),
                    "to": _decode(message.get("To")),
                    "subject": _decode(message.get("Subject")) or "(no subject)",
                    "receivedAt": message.get("Date", ""),
                    "body": _body(message),
                }
            ],
        }
    finally:
        _close(client)


def _close(client: imaplib.IMAP4_SSL) -> None:
    """Logout, ignoring failures.

    A server that has already dropped the connection raises here, and that
    must not turn a mailbox read that already succeeded into an error.
    """
    try:
        client.logout()
    except Exception:
        logger.debug("IMAP logout failed", exc_info=True)


def _check_sync() -> str:
    """Logs in and returns the mailbox address, to prove the settings work."""
    client = _connect()
    try:
        client.select("INBOX", readonly=True)
        return settings.imap_username or ""
    finally:
        _close(client)


# --- async wrappers ---------------------------------------------------------
# imaplib is blocking, so each call runs in a worker thread rather than
# stalling the event loop for the duration of a mail server round trip.


async def list_threads(limit: int = 25) -> list[dict]:
    _require_config()
    return await asyncio.to_thread(_list_threads_sync, min(limit, MAX_LIMIT))


async def get_thread(thread_id: str) -> dict | None:
    _require_config()
    return await asyncio.to_thread(_get_thread_sync, thread_id)


async def check_connection() -> str:
    _require_config()
    return await asyncio.to_thread(_check_sync)
