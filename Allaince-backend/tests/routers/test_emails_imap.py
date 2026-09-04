"""The shared inbox over IMAP.

The mailbox is read with the account's own password rather than a scoped
OAuth token, so the tests that matter most are the ones about restraint:
that the connection is opened read-only, and that the password never leaves
the server.

Everything is exercised against a fake IMAP client -- a real one would need
a live mailbox and network, and these are checking this app's behaviour, not
imaplib's.
"""

import email

import pytest

from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.integrations import imap_mail
from app.models import Employee
from app.schemas.session import AdminSession


def _auth(client, role="super", **kwargs):
    client.cookies.set(
        ADMIN_SESSION_COOKIE,
        create_session_token(AdminSession(role=role, name="A", email="a@x.com", **kwargs)),
    )


RAW_PLAIN = b"""From: Rahim Traders <rahim@example.com>
To: info@auto-bd.com
Subject: =?UTF-8?B?UXVvdGF0aW9uIGZvciBQTEM=?=
Date: Sun, 31 Aug 2026 09:15:00 +0600
Content-Type: text/plain; charset="utf-8"

Please send your best price for 6ES7215-1AG40-0XB0.
"""

RAW_MULTIPART = b"""From: Karim <karim@example.com>
To: info@auto-bd.com
Subject: Order update
Date: Sun, 31 Aug 2026 10:00:00 +0600
Content-Type: multipart/alternative; boundary="BOUND"

--BOUND
Content-Type: text/plain; charset="utf-8"

The plain text part.
--BOUND
Content-Type: text/html; charset="utf-8"

<html><body><p>The HTML part.</p></body></html>
--BOUND--
"""

RAW_HTML_ONLY = b"""From: Newsletter <news@example.com>
To: info@auto-bd.com
Subject: Weekly
Date: Sun, 31 Aug 2026 11:00:00 +0600
Content-Type: text/html; charset="utf-8"

<html><body><h1>Heading</h1><p>Body   text.</p></body></html>
"""


class FakeIMAP:
    """Enough of imaplib.IMAP4_SSL for these tests, recording how it is used."""

    def __init__(self, messages: dict[bytes, bytes], unseen: list[bytes] | None = None):
        self.messages = messages
        self.unseen = unseen or []
        self.selected_readonly: bool | None = None
        self.logged_out = False

    def select(self, mailbox, readonly=False):
        self.selected_readonly = readonly
        return "OK", [b""]

    def search(self, charset, criterion):
        if criterion == "UNSEEN":
            return "OK", [b" ".join(self.unseen)]
        return "OK", [b" ".join(self.messages.keys())]

    def fetch(self, uid, parts):
        raw = self.messages.get(uid if isinstance(uid, bytes) else uid.encode())
        if raw is None:
            return "NO", [None]
        return "OK", [(b"1 (RFC822 {})", raw)]

    def logout(self):
        self.logged_out = True
        return "BYE", [b""]


@pytest.fixture
def fake_imap(monkeypatch):
    # The settings have to be present as well as the client stubbed: the
    # config guard runs before anything connects, which is the behaviour
    # test_reading_without_configuration_is_refused relies on.
    from app.config import settings

    monkeypatch.setattr(settings, "imap_host", "mail.privateemail.com")
    monkeypatch.setattr(settings, "imap_username", "info@auto-bd.com")
    monkeypatch.setattr(settings, "imap_password", "secret")

    fake = FakeIMAP(
        messages={b"101": RAW_PLAIN, b"102": RAW_MULTIPART},
        unseen=[b"102"],
    )
    monkeypatch.setattr(imap_mail, "_connect", lambda: fake)
    return fake


async def test_reading_without_configuration_is_refused(monkeypatch):
    """No settings means no connection attempt at all."""
    from app.config import settings

    monkeypatch.setattr(settings, "imap_password", None)
    with pytest.raises(imap_mail.ImapNotConfigured):
        await imap_mail.list_threads()


# --- reading ---------------------------------------------------------------


async def test_the_mailbox_is_opened_read_only(fake_imap):
    """The whole integration is read-only. Opening read-write would clear
    \\Seen as messages are fetched, marking the business's mail as read just
    because an admin opened the dashboard."""
    await imap_mail.list_threads(limit=10)
    assert fake_imap.selected_readonly is True


async def test_threads_come_back_newest_first_with_decoded_subjects(fake_imap):
    threads = await imap_mail.list_threads(limit=10)

    assert [t["id"] for t in threads] == ["102", "101"]
    # The subject arrives as =?UTF-8?B?...?= and must not render as that.
    assert threads[1]["subject"] == "Quotation for PLC"
    assert threads[1]["from"] == "Rahim Traders <rahim@example.com>"


async def test_unread_state_comes_from_the_unseen_search(fake_imap):
    threads = {t["id"]: t for t in await imap_mail.list_threads(limit=10)}
    assert threads["102"]["unread"] is True
    assert threads["101"]["unread"] is False


async def test_the_connection_is_closed_even_when_reading_fails(fake_imap):
    """A half-open connection per page load would exhaust the mail server's
    limits, so logout has to happen on the failure path too."""

    def _explode(*args, **kwargs):
        raise RuntimeError("mailbox vanished")

    fake_imap.search = _explode

    with pytest.raises(RuntimeError):
        await imap_mail.list_threads()
    assert fake_imap.logged_out is True


async def test_a_logout_failure_does_not_fail_a_successful_read(fake_imap):
    """A server that has already dropped the connection raises on logout;
    that must not turn a read that already worked into an error."""

    def _explode():
        raise OSError("connection reset")

    fake_imap.logout = _explode
    threads = await imap_mail.list_threads(limit=10)
    assert len(threads) == 2


# --- body extraction -------------------------------------------------------


def test_plain_text_is_preferred_over_html():
    message = email.message_from_bytes(RAW_MULTIPART)
    assert imap_mail._body(message).strip() == "The plain text part."


def test_html_only_mail_still_yields_a_body_and_a_clean_preview():
    message = email.message_from_bytes(RAW_HTML_ONLY)
    assert "<h1>" in imap_mail._body(message)
    # The preview strips tags and collapses whitespace, so the list does not
    # show a wall of markup.
    preview = imap_mail._preview(message)
    assert "<" not in preview
    assert "Heading Body text." in preview


def test_attachments_are_skipped_when_looking_for_a_body():
    raw = b"""From: a@b.com
To: info@auto-bd.com
Subject: With attachment
Content-Type: multipart/mixed; boundary="B"

--B
Content-Type: application/pdf; name="po.pdf"
Content-Disposition: attachment; filename="po.pdf"

JVBERi0xLjQK
--B
Content-Type: text/plain; charset="utf-8"

The real message.
--B--
"""
    message = email.message_from_bytes(raw)
    assert imap_mail._body(message).strip() == "The real message."


def test_a_malformed_subject_falls_back_to_the_raw_value():
    """An ugly subject beats a failed inbox load."""
    assert imap_mail._decode("=?BROKEN?X?zzz?=").startswith("=?BROKEN")
    assert imap_mail._decode(None) == ""


# --- endpoint --------------------------------------------------------------


async def test_status_reports_imap_and_never_returns_the_password(
    client, db, monkeypatch
):
    """The password is the whole mailbox. It must not appear in any payload
    the browser can read."""
    from app.config import settings

    monkeypatch.setattr(settings, "imap_host", "mail.privateemail.com")
    monkeypatch.setattr(settings, "imap_username", "info@auto-bd.com")
    monkeypatch.setattr(settings, "imap_password", "super-secret-value")

    async def _ok():
        return "info@auto-bd.com"

    monkeypatch.setattr(imap_mail, "check_connection", _ok)

    _auth(client)
    r = await client.get("/api/admin/emails/status")
    assert r.status_code == 200
    body = r.json()
    assert body["provider"] == "imap"
    assert body["connected"] is True
    assert body["email"] == "info@auto-bd.com"
    assert "super-secret-value" not in r.text


async def test_a_failed_login_is_reported_rather_than_crashing_the_page(
    client, db, monkeypatch
):
    from app.config import settings

    monkeypatch.setattr(settings, "imap_host", "mail.privateemail.com")
    monkeypatch.setattr(settings, "imap_username", "info@auto-bd.com")
    monkeypatch.setattr(settings, "imap_password", "wrong")

    async def _fail():
        raise RuntimeError("AUTHENTICATIONFAILED")

    monkeypatch.setattr(imap_mail, "check_connection", _fail)

    _auth(client)
    r = await client.get("/api/admin/emails/status")
    assert r.status_code == 200
    body = r.json()
    assert body["configured"] is True
    assert body["connected"] is False
    assert "AUTHENTICATIONFAILED" in body["error"]


async def test_imap_takes_precedence_over_leftover_gmail_credentials(
    client, db, monkeypatch
):
    """Explicit IMAP settings are a deliberate act; stale Google credentials
    may just be from a previous setup."""
    from app.config import settings

    monkeypatch.setattr(settings, "imap_host", "mail.privateemail.com")
    monkeypatch.setattr(settings, "imap_username", "info@auto-bd.com")
    monkeypatch.setattr(settings, "imap_password", "x")
    monkeypatch.setattr(settings, "google_oauth_client_id", "gid")
    monkeypatch.setattr(settings, "google_oauth_client_secret", "gsecret")
    monkeypatch.setattr(settings, "google_oauth_redirect_uri", "https://x/cb")

    assert settings.mailbox_provider == "imap"


async def test_the_inbox_is_super_admin_only(client, db):
    db.add(
        Employee(
            id="emp-1", employee_id_number="emp-1", name="Sub", email="sub@x.com",
            password_hash="x", role="sub", access_options=[],
        )
    )
    await db.commit()

    _auth(client, role="sub", employee_id="emp-1")
    assert (await client.get("/api/admin/emails/status")).status_code == 403


# --- Replying ---------------------------------------------------------------
#
# Mail is read over IMAP but sent through Resend, so a reply is a new message
# addressed and threaded to look like one. The mailbox stays read-only.


@pytest.fixture
def sent_mail(monkeypatch):
    """Captures what would have been sent, instead of sending it."""
    from app.routers import emails as emails_router

    captured: list[dict] = []

    async def _capture(to, subject, html, attachments=None, headers=None, reply_to=None):
        captured.append(
            {"to": to, "subject": subject, "html": html, "headers": headers}
        )
        return True

    monkeypatch.setattr(emails_router.email_integration, "send_email", _capture)
    return captured


async def test_a_reply_goes_to_the_senders_address(client, fake_imap, sent_mail):
    """The address comes from the stored message, never from the request."""
    _auth(client)
    response = await client.post("/api/admin/emails/101/reply", json={"body": "Our price is attached."})

    assert response.status_code == 202
    assert response.json()["to"] == "rahim@example.com"
    assert sent_mail[0]["to"] == "rahim@example.com"


async def test_a_reply_subject_is_prefixed_once(client, fake_imap, sent_mail):
    """"Re: Re: ..." is what happens when a reply to a reply re-prefixes."""
    _auth(client)
    await client.post("/api/admin/emails/101/reply", json={"body": "Noted."})
    assert sent_mail[0]["subject"] == "Re: Quotation for PLC"

    # A subject that already carries the prefix is left alone.
    fake_imap.messages[b"103"] = RAW_PLAIN.replace(
        b"Subject: =?UTF-8?B?UXVvdGF0aW9uIGZvciBQTEM=?=", b"Subject: Re: Already replied"
    )
    await client.post("/api/admin/emails/103/reply", json={"body": "Again."})
    assert sent_mail[1]["subject"] == "Re: Already replied"


async def test_the_reply_quotes_the_message_it_answers(client, fake_imap, sent_mail):
    _auth(client)
    await client.post("/api/admin/emails/101/reply", json={"body": "Sending shortly."})

    html = sent_mail[0]["html"]
    assert "Sending shortly." in html
    assert "6ES7215-1AG40-0XB0" in html


async def test_the_reply_body_is_escaped_not_injected(client, fake_imap, sent_mail):
    """The compose box is a textarea; markup typed there is content, not HTML."""
    _auth(client)
    await client.post(
        "/api/admin/emails/101/reply", json={"body": "<script>alert(1)</script>"}
    )

    html = sent_mail[0]["html"]
    assert "<script>alert(1)</script>" not in html
    assert "&lt;script&gt;" in html


async def test_a_reply_to_a_message_that_does_not_exist_is_404(client, fake_imap, sent_mail):
    _auth(client)
    response = await client.post("/api/admin/emails/999/reply", json={"body": "Hello."})

    assert response.status_code == 404
    assert sent_mail == []


async def test_an_empty_reply_is_rejected(client, fake_imap, sent_mail):
    _auth(client)
    response = await client.post("/api/admin/emails/101/reply", json={"body": ""})

    assert response.status_code == 422
    assert sent_mail == []


async def test_a_reply_that_cannot_be_sent_is_reported_not_silently_dropped(
    client, fake_imap, monkeypatch
):
    """Resend unconfigured returns False. Reporting success there would tell
    an admin their answer went out when it never left the building."""
    from app.routers import emails as emails_router

    async def _fails(*args, **kwargs):
        return False

    monkeypatch.setattr(emails_router.email_integration, "send_email", _fails)

    _auth(client)
    response = await client.post("/api/admin/emails/101/reply", json={"body": "Hello."})
    assert response.status_code == 502


async def test_replying_is_super_admin_only(client, db, fake_imap, sent_mail):
    db.add(
        Employee(
            id="emp-2", employee_id_number="emp-2", name="Sub", email="sub2@x.com",
            password_hash="x", role="sub", access_options=["emails"],
        )
    )
    await db.commit()

    _auth(client, role="sub", employee_id="emp-2", access_options=["emails"])
    response = await client.post("/api/admin/emails/101/reply", json={"body": "Hi."})

    assert response.status_code == 403
    assert sent_mail == []
