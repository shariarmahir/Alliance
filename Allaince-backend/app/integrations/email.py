import logging
import re
from contextvars import ContextVar
from html import escape

from app.config import settings

logger = logging.getLogger("app.email")


def _configured() -> bool:
    return bool(settings.resend_api_key)


class SendFailure(RuntimeError):
    """Why a send failed, in words an admin can act on.

    send_email still returns a bool, because most callers only branch on
    success. This carries the reason alongside it for the ones that surface
    an error to a person: "check the mail configuration" is actively
    misleading when the configuration is fine and the account has simply run
    out of daily quota.
    """

    def __init__(self, message: str, *, status: int = 502):
        super().__init__(message)
        self.status = status


# Why the most recent send in *this task* failed. A ContextVar rather than a
# plain global: the API serves requests concurrently on one event loop, and a
# module-level value would let one request report the failure reason belonging
# to another. Each asyncio task gets its own view, and it is reset at the start
# of every send so a stale reason cannot outlive the failure that set it.
_last_failure: ContextVar[SendFailure | None] = ContextVar(
    "email_last_failure", default=None
)


def last_failure() -> SendFailure | None:
    """The reason the most recent send failed, or None if it succeeded."""
    return _last_failure.get()


def _classify(exc: Exception) -> SendFailure:
    """Turns a Resend exception into something worth showing an admin."""
    name = type(exc).__name__
    text = str(exc)

    if "RateLimit" in name or "quota" in text.lower():
        return SendFailure(
            "The mail provider's daily sending quota has been reached. "
            "Sending resumes when the quota resets, or upgrade the Resend plan.",
            status=429,
        )
    if "Validation" in name or "not verified" in text.lower():
        return SendFailure(f"The mail provider rejected the message: {text}", status=422)
    if "Authentication" in name or "api_key" in text.lower() or "unauthorized" in text.lower():
        return SendFailure(
            "The mail provider rejected the API key. Check RESEND_API_KEY.", status=502
        )
    return SendFailure(f"The mail provider could not send this message: {text}", status=502)


async def send_email(
    to: str | list[str],
    subject: str,
    html: str,
    attachments: list[dict] | None = None,
    headers: dict[str, str] | None = None,
    reply_to: str | None = None,
) -> bool:
    """Sends via Resend. Returns False (rather than raising) when email is not
    configured, so a missing API key degrades to "not sent" instead of taking
    down the request that triggered it.

    `headers` carries In-Reply-To/References when this is a reply, which is
    what makes the answer appear under the original in the recipient's client
    instead of starting a new conversation.
    """
    _last_failure.set(None)

    if not _configured():
        logger.info("Email not configured; skipping send of %r to %s", subject, to)
        _last_failure.set(
            SendFailure(
                "Email sending is not configured on the server. Set RESEND_API_KEY.",
                status=503,
            )
        )
        return False

    try:
        import resend

        resend.api_key = settings.resend_api_key
        params: dict = {
            "from": settings.resend_from_email,
            "to": [to] if isinstance(to, str) else to,
            "subject": subject,
            "html": html,
        }
        if attachments:
            params["attachments"] = attachments
        if headers:
            params["headers"] = headers
        if reply_to:
            params["reply_to"] = reply_to
        resend.Emails.send(params)
        return True
    except Exception as exc:
        logger.exception("Resend send failed for %r", subject)
        _last_failure.set(_classify(exc))
        return False


def _shell(title: str, body: str) -> str:
    # Inline styles only — email clients strip <style> blocks.
    return f"""<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f7fa;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e3e8ef">
    <div style="background:#007DCC;padding:20px 24px">
      <span style="color:#fff;font-size:20px;font-weight:700">AutoLink</span><span style="color:#FFB900;font-size:20px;font-weight:700">.</span>
      <div style="color:#d7ecfb;font-size:12px;margin-top:2px">Integrated Technologies</div>
    </div>
    <div style="padding:24px">
      <h1 style="margin:0 0 16px;font-size:18px">{escape(title)}</h1>
      {body}
    </div>
    <div style="padding:16px 24px;background:#fafbfc;border-top:1px solid #e3e8ef;font-size:12px;color:#667085">
      House: 104, Road: 15, Sector: 11, Uttara, Dhaka-1230, Bangladesh<br>
      {escape(settings.resend_from_email)} &middot; +8801315-770099
    </div>
  </div>
</body></html>"""


def _letter(greeting_name: str, paragraphs: list[str], block: str = "") -> str:
    """A plain covering letter, signed.

    The customer-facing emails used to restate the attachment in the body --
    reference, amount, billed-to, the full terms table, sometimes the line
    items. That made the email a second copy of the document it carried, and
    a second copy is a second thing that can disagree with the first: a
    revised PDF and a stale body, or a part-paid invoice quoting the order's
    original total.

    The document is the record. The email is the note that accompanies it, so
    it now reads as one: address the customer, say what is attached, sign off.

    `paragraphs` arrive as already-escaped HTML because most carry an inline
    <strong> reference; anything interpolated into them is escaped at the
    call site.

    `block` is for table-level content that cannot live inside a <p> without
    producing markup email clients render unpredictably. It sits after the
    paragraphs and before the sign-off.
    """
    body = "".join(
        f'<p style="font-size:14px;line-height:1.7;margin:0 0 14px">{p}</p>'
        for p in paragraphs
    )
    return (
        f'<p style="font-size:14px;margin:0 0 14px">Dear {escape(greeting_name)},</p>'
        + body
        + block
        + '<p style="font-size:14px;line-height:1.7;margin:26px 0 0">Best Regards,<br>'
        '<span style="color:#667085">'
        "&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;&mdash;</span><br>"
        "Md. Nurul Islam<br>"
        "Manager &ndash; Sales</p>"
    )


def _greeting(details: dict) -> str:
    return details.get("fullName") or "Customer"


def _rows(pairs: list[tuple[str, str]]) -> str:
    return "".join(
        f'<tr><td style="padding:6px 12px 6px 0;color:#667085;font-size:13px">{escape(k)}</td>'
        f'<td style="padding:6px 0;font-size:13px"><strong>{escape(str(v))}</strong></td></tr>'
        for k, v in pairs
    )


def _line_items_table(confirmation) -> str:
    """Itemised offer lines.

    The PDF is the contractual document, but an attachment many customers read
    on a phone should not be the only way to see what was actually quoted.
    """
    lines = confirmation.lines or []
    if not lines:
        return ""

    header = (
        '<tr style="background:#f8fafc">'
        '<th align="left" style="padding:8px 10px;font-size:11.5px;color:#667085;'
        'text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e3e8ef">Item</th>'
        '<th align="right" style="padding:8px 10px;font-size:11.5px;color:#667085;'
        'text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e3e8ef">Qty</th>'
        '<th align="right" style="padding:8px 10px;font-size:11.5px;color:#667085;'
        'text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e3e8ef">'
        "Unit price</th>"
        '<th align="right" style="padding:8px 10px;font-size:11.5px;color:#667085;'
        'text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e3e8ef">Amount</th>'
        "</tr>"
    )

    rows = []
    for line in lines:
        name = escape(str(line.get("name", "—")))
        part = str(line.get("partNumber") or line.get("part_number") or "").strip()
        part_html = (
            f'<div style="font-size:11.5px;color:#8a94a6;margin-top:2px">'
            f"{escape(part)}</div>"
            if part
            else ""
        )
        quantity = line.get("quantity", 0)
        unit = escape(str(line.get("unit") or "Pcs"))
        unit_price = float(line.get("unitPrice") or line.get("unit_price") or 0)
        total = float(line.get("total") or unit_price * float(quantity or 0))
        rows.append(
            '<tr><td style="padding:10px;font-size:13px;border-bottom:1px solid #eef1f5">'
            f"{name}{part_html}</td>"
            '<td align="right" style="padding:10px;font-size:13px;white-space:nowrap;'
            f'border-bottom:1px solid #eef1f5">{quantity} {unit}</td>'
            '<td align="right" style="padding:10px;font-size:13px;white-space:nowrap;'
            f'border-bottom:1px solid #eef1f5">{unit_price:,.2f}</td>'
            '<td align="right" style="padding:10px;font-size:13px;white-space:nowrap;'
            f'border-bottom:1px solid #eef1f5"><strong>{total:,.2f}</strong></td></tr>'
        )

    grand = (
        '<tr><td colspan="3" align="right" style="padding:12px 10px;font-size:13.5px">'
        "<strong>Grand total</strong></td>"
        '<td align="right" style="padding:12px 10px;font-size:15px;white-space:nowrap">'
        f"<strong>BDT {confirmation.grand_total:,.2f}</strong></td></tr>"
    )

    return (
        '<table style="width:100%;border-collapse:collapse;margin:16px 0 0;'
        'border:1px solid #e3e8ef;border-radius:6px">'
        f"{header}{''.join(rows)}{grand}</table>"
    )


async def notify_new_quotation(quotation) -> bool:
    """Internal notification that a price request arrived."""
    details = quotation.details or {}
    body = (
        f'<table style="width:100%;border-collapse:collapse">'
        f"{_rows([('Company', details.get('companyName', '—')), ('Contact', details.get('fullName', '—')), ('Email', details.get('email', '—')), ('Phone', details.get('phone', '—')), ('Items', str(len(quotation.items or []))), ('Estimated total', f'{quotation.total:,.2f}')])}"
        f"</table>"
        f'<p style="margin-top:20px;font-size:13px;color:#475467">'
        f"Open the admin Quotations screen to price and issue this request.</p>"
    )
    return await send_email(
        settings.notify_internal_email,
        f"New price request from {details.get('companyName') or details.get('fullName') or 'a customer'}",
        _shell("New price request", body),
    )


async def notify_new_contact(contact) -> bool:
    body = (
        f'<table style="width:100%;border-collapse:collapse">'
        f"{_rows([('Name', contact.name), ('Email', contact.email), ('Subject', contact.subject or '—')])}"
        f"</table>"
        f'<div style="margin-top:16px;padding:12px;background:#f8fafc;border-left:3px solid #007DCC;'
        f'font-size:13px;white-space:pre-wrap">{escape(contact.message)}</div>'
    )
    return await send_email(
        settings.notify_internal_email,
        f"Contact form: {contact.subject or 'New message'}",
        _shell("New contact request", body),
    )


async def send_quotation_issued(quotation, pdf_bytes: bytes | None = None) -> bool:
    """Sends the issued offer to the customer, with the PDF attached when
    rendering succeeded."""
    details = quotation.details or {}
    confirmation = quotation.confirmation
    to = details.get("email")
    if not to:
        logger.warning("Quotation %s has no customer email; not sending.", quotation.id)
        return False

    # The admin's own subject line, when they wrote one. Kept because it is
    # written per quotation and says something the PDF does not -- unlike the
    # tables that used to follow it, which only restated the attachment.
    paragraphs = [
        "With reference to your valued inquiry, we are pleased to submit our "
        "best competitive offer for your kind consideration.",
        "Please find attached our price quotation, reference "
        f"<strong>{escape(confirmation.ref_number)}</strong>, for your review. "
        "We sincerely hope our offer meets your requirements and expectations.",
        "We look forward to receiving your valued order and establishing a "
        "long-term business relationship with your esteemed organization.",
    ]
    subject_note = (confirmation.subject or "").strip()
    if subject_note:
        paragraphs.insert(0, escape(subject_note))

    body = _letter(_greeting(details), paragraphs)

    attachments = None
    if pdf_bytes:
        import base64

        attachments = [
            {
                "filename": f"{confirmation.ref_number.replace('/', '-')}.pdf",
                "content": base64.b64encode(pdf_bytes).decode(),
            }
        ]

    return await send_email(
        to,
        # Reference in the subject so a reply thread stays findable, and the
        # total so the recipient can triage without opening the attachment.
        f"Quotation {confirmation.ref_number} — BDT {confirmation.grand_total:,.2f}",
        _shell(f"Quotation {confirmation.ref_number}", body),
        attachments,
    )


async def send_order_confirmed(quotation) -> bool:
    """Tells the customer their order is confirmed and in preparation.

    Sent when an admin moves the order to Confirmed on the Orders screen —
    the point at which the business has committed to fulfilling it. Carries
    no PDF: the customer already has the quotation, and nothing about the
    priced offer changes here.
    """
    details = quotation.details or {}
    confirmation = quotation.confirmation
    to = details.get("email")
    if not to:
        logger.warning("Quotation %s has no customer email; not sending.", quotation.id)
        return False
    if confirmation is None:
        logger.warning("Quotation %s has no confirmation; not sending.", quotation.id)
        return False

    # The one customer email that carries no attachment, so the line items
    # stay: here they are the only record of what was ordered, not a second
    # copy of one. Passed as `block` because a <table> inside a <p> is markup
    # email clients render however they like.
    body = _letter(
        _greeting(details),
        [
            "We are pleased to confirm your order against reference "
            f"<strong>{escape(confirmation.ref_number)}</strong>, which is now "
            "in preparation.",
            "Our team will contact you directly to arrange freight and delivery. "
            "We thank you for your valued business.",
        ],
        block=_line_items_table(confirmation),
    )

    return await send_email(
        to,
        f"Order confirmed — {confirmation.ref_number}",
        _shell(f"Order confirmed — {confirmation.ref_number}", body),
    )


async def send_challan(quotation, pdf_bytes: bytes | None = None) -> bool:
    """Sends the delivery challan to the customer with the PDF attached.

    The challan accompanies the goods, so this is a short covering note: the
    document itself carries the detail, and unlike the quotation there are no
    prices to restate here.
    """
    details = quotation.details or {}
    confirmation = quotation.confirmation
    to = details.get("email")
    if not to:
        logger.warning("Quotation %s has no customer email; not sending.", quotation.id)
        return False
    if confirmation is None:
        logger.warning("Quotation %s has no confirmation; not sending.", quotation.id)
        return False

    body = _letter(
        _greeting(details),
        [
            "We are pleased to inform you that your order has been dispatched.",
            "Please find attached the delivery challan against reference "
            f"<strong>{escape(confirmation.ref_number)}</strong>. Kindly check "
            "the items on receipt and inform us straight away if anything does "
            "not match.",
            "We thank you for your valued order and look forward to serving you "
            "again.",
        ],
    )

    attachments = None
    if pdf_bytes:
        import base64

        attachments = [
            {
                "filename": f"Challan-{confirmation.ref_number.replace('/', '-')}.pdf",
                "content": base64.b64encode(pdf_bytes).decode(),
            }
        ]

    return await send_email(
        to,
        f"Delivery challan — {confirmation.ref_number}",
        _shell(f"Delivery challan — {confirmation.ref_number}", body),
        attachments,
    )


async def send_invoice(quotation, pdf_bytes: bytes | None = None, invoice=None) -> bool:
    """Sends an invoice to the customer with the PDF attached.

    `invoice` carries the real document — its own number, its own total, and
    its own outstanding balance. Without it this fell back to deriving a
    reference from the quotation and quoting the quotation's total, so a
    part-paid or partially-invoiced order was billed for the wrong amount
    under a number that appeared on no record anywhere.
    """
    details = quotation.details or {}
    confirmation = quotation.confirmation
    to = details.get("email")
    if not to:
        logger.warning("Quotation %s has no customer email; not sending.", quotation.id)
        return False
    if confirmation is None:
        logger.warning("Quotation %s has no confirmation; not sending.", quotation.id)
        return False

    if invoice is not None:
        invoice_ref = invoice.invoice_number or confirmation.ref_number
        amount = invoice.grand_total
        outstanding = invoice.grand_total - invoice.amount_paid
    else:
        # Legacy callers that have no Invoice row to hand.
        invoice_ref = re.sub(r"/Q-?", "/I", confirmation.ref_number, flags=re.IGNORECASE)
        amount = confirmation.grand_total
        outstanding = None

    # `amount` carries into the subject line, which is where a figure earns
    # its place: it lets the recipient triage the message without opening the
    # attachment. Inside the body the invoice speaks for itself.
    body = _letter(
        _greeting(details),
        [
            "Thank you for your valued order. We are pleased to enclose our "
            "invoice for your kind attention.",
            "Please find attached the invoice, reference "
            f"<strong>{escape(invoice_ref)}</strong>, covering your confirmed "
            "order. Kindly review it at your convenience and let us know if "
            "anything requires clarification.",
            "We thank you for your continued confidence in AutoLink Integrated "
            "Technologies and look forward to serving you again.",
        ],
    )

    attachments = None
    if pdf_bytes:
        import base64

        attachments = [
            {
                "filename": f"Invoice-{invoice_ref.replace('/', '-')}.pdf",
                "content": base64.b64encode(pdf_bytes).decode(),
            }
        ]

    return await send_email(
        to,
        f"Invoice {invoice_ref} — BDT {amount:,.2f}",
        _shell(f"Invoice {invoice_ref}", body),
        attachments,
    )


async def send_receipt(quotation, pdf_bytes: bytes | None = None) -> bool:
    """Sends the money receipt acknowledging payment, with the PDF attached.

    Short by design: a receipt confirms one fact — that this amount arrived —
    so restating line items or terms here would only bury it.
    """
    details = quotation.details or {}
    confirmation = quotation.confirmation
    to = details.get("email")
    if not to:
        logger.warning("Quotation %s has no customer email; not sending.", quotation.id)
        return False
    if confirmation is None:
        logger.warning("Quotation %s has no confirmation; not sending.", quotation.id)
        return False

    receipt_ref = re.sub(r"/Q-?", "/R", confirmation.ref_number, flags=re.IGNORECASE)

    body = _letter(
        _greeting(details),
        [
            "We gratefully acknowledge receipt of your payment against order "
            f"<strong>{escape(confirmation.ref_number)}</strong>.",
            "Please find the money receipt attached for your records. Should "
            "anything on it require correction, kindly let us know.",
            "We thank you for your prompt settlement and for your continued "
            "confidence in AutoLink Integrated Technologies.",
        ],
    )

    attachments = None
    if pdf_bytes:
        import base64

        attachments = [
            {
                "filename": f"Receipt-{receipt_ref.replace('/', '-')}.pdf",
                "content": base64.b64encode(pdf_bytes).decode(),
            }
        ]

    return await send_email(
        to,
        f"Payment received — {confirmation.ref_number}",
        _shell(f"Money receipt {receipt_ref}", body),
        attachments,
    )


def reply_html(body: str, original: dict) -> str:
    """An admin's reply, with the message being answered quoted beneath it.

    The quote is what makes a reply readable months later: the customer sees
    which of their messages this answers without opening their own sent mail.
    Plain text in, escaped here -- the reply is typed into a textarea, so
    treating it as HTML would let markup from the compose box reach the
    recipient's client.
    """
    paragraphs = "".join(
        f'<p style="margin:0 0 12px;font-size:14px;line-height:1.6">{escape(line)}</p>'
        for line in body.strip().split("\n")
        if line.strip()
    )

    quoted_body = (original.get("body") or "").strip()
    quote = ""
    if quoted_body:
        # Trimmed: a long thread quoted in full buries the actual reply.
        excerpt = quoted_body[:2000]
        quote = f"""
    <div style="margin-top:20px;padding-left:12px;border-left:3px solid #e3e8ef;color:#667085;font-size:13px;line-height:1.6">
      <div style="margin-bottom:6px">On {escape(original.get("receivedAt", ""))}, {escape(original.get("from", ""))} wrote:</div>
      <div style="white-space:pre-wrap">{escape(excerpt)}</div>
    </div>"""

    return _shell(original.get("subject") or "Reply", paragraphs + quote)
