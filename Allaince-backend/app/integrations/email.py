import logging
import re
from html import escape

from app.config import settings

logger = logging.getLogger("app.email")


def _configured() -> bool:
    return bool(settings.resend_api_key)


async def send_email(
    to: str | list[str], subject: str, html: str, attachments: list[dict] | None = None
) -> bool:
    """Sends via Resend. Returns False (rather than raising) when email is not
    configured, so a missing API key degrades to "not sent" instead of taking
    down the request that triggered it."""
    if not _configured():
        logger.info("Email not configured; skipping send of %r to %s", subject, to)
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
        resend.Emails.send(params)
        return True
    except Exception:
        logger.exception("Resend send failed for %r", subject)
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


def _rows(pairs: list[tuple[str, str]]) -> str:
    return "".join(
        f'<tr><td style="padding:6px 12px 6px 0;color:#667085;font-size:13px">{escape(k)}</td>'
        f'<td style="padding:6px 0;font-size:13px"><strong>{escape(str(v))}</strong></td></tr>'
        for k, v in pairs
    )


def _company_clause(details: dict) -> str:
    company = (details.get("companyName") or "").strip()
    return f" on behalf of {escape(company)}" if company else ""


def _subject_block(confirmation) -> str:
    """The admin-written subject line, when there is one.

    Free text typed per quotation, so it is escaped like any other untrusted
    input even though it originates internally.
    """
    subject = (confirmation.subject or "").strip()
    if not subject:
        return ""
    return (
        '<div style="margin:14px 0 0;padding:12px 14px;background:#f4faff;'
        'border-left:3px solid #007DCC;font-size:13.5px;line-height:1.6">'
        f"{escape(subject)}</div>"
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


# Printed in this order because it is the order the PDF and the admin form use;
# a customer comparing the two should not have to hunt.
_TERM_LABELS = (
    ("payment", "Payment"),
    ("delivery", "Delivery"),
    ("offerValidity", "Offer validity"),
    ("vatAit", "VAT / AIT"),
    ("stock", "Stock"),
    ("installationCharge", "Installation"),
    ("warranty", "Warranty"),
)


def _terms_block(terms: dict) -> str:
    present = [(label, terms.get(key)) for key, label in _TERM_LABELS if terms.get(key)]
    if not present:
        return ""
    return (
        '<div style="margin:20px 0 0"><div style="font-size:11.5px;color:#667085;'
        'text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">'
        "Terms of this offer</div>"
        '<table style="width:100%;border-collapse:collapse">'
        + _rows([(label, value) for label, value in present])
        + "</table></div>"
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

    # Points at the customer's own request page, not a tracking ID: there is
    # no self-service tracking surface, and acceptance happens by the
    # customer replying to this email — an admin then confirms it from the
    # dashboard. This link is informational, not an "accept" action.
    request_url = f"{settings.public_site_url.rstrip('/')}/quote/thank-you/{quotation.id}"
    terms = confirmation.terms or {}

    body = (
        f"<p style=\"font-size:14px;margin:0 0 14px\">Dear {escape(details.get('fullName') or 'Customer')},</p>"
        f'<p style="font-size:14px;line-height:1.65;margin:0 0 8px">Thank you for your enquiry'
        f"{_company_clause(details)}. We are pleased to offer the following, "
        f"quoted against reference <strong>{escape(confirmation.ref_number)}</strong>. "
        f"The full quotation is attached as a PDF.</p>"
        + _subject_block(confirmation)
        + '<table style="width:100%;border-collapse:collapse;margin:18px 0 4px">'
        + _rows(
            [
                ("Reference", confirmation.ref_number),
                ("Offer date", str(confirmation.issued_date)),
                ("Prepared for", details.get("companyName") or details.get("fullName") or "—"),
            ]
        )
        + "</table>"
        + _line_items_table(confirmation)
        + _terms_block(terms)
        + '<p style="margin:22px 0 6px"><a href="'
        + escape(request_url)
        + '" style="display:inline-block;background:#007DCC;color:#fff;padding:11px 20px;'
        'border-radius:6px;text-decoration:none;font-size:14px;font-weight:bold">'
        "View this request</a></p>"
        '<p style="font-size:12.5px;color:#667085;line-height:1.6;margin:10px 0 0">'
        "Reply to this email to accept the offer. To adjust quantities or "
        "specifications, reply with the changes and an engineer will re-issue "
        "a revised offer.</p>"
        '<p style="font-size:13px;line-height:1.65;margin:18px 0 0;padding-top:16px;'
        'border-top:1px solid #e3e8ef">Questions about compatibility or lead time? '
        "Reply here, or message us on WhatsApp at "
        '<strong>+8801315-770099</strong> — sending a photo of the equipment '
        "nameplate is usually the fastest way for us to confirm the exact part.</p>"
    )

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

    body = (
        f"<p style=\"font-size:14px;margin:0 0 14px\">Dear {escape(details.get('fullName') or 'Customer')},</p>"
        f'<p style="font-size:14px;line-height:1.65;margin:0 0 8px">Your order against reference '
        f"<strong>{escape(confirmation.ref_number)}</strong> is now confirmed and being "
        f"prepared. Thank you for your business.</p>"
        + '<table style="width:100%;border-collapse:collapse;margin:18px 0 4px">'
        + _rows(
            [
                ("Reference", confirmation.ref_number),
                ("Order value", f"BDT {confirmation.grand_total:,.2f}"),
                ("Prepared for", details.get("companyName") or details.get("fullName") or "—"),
            ]
        )
        + "</table>"
        + _line_items_table(confirmation)
        + '<p style="font-size:13px;line-height:1.65;margin:18px 0 0;padding-top:16px;'
        'border-top:1px solid #e3e8ef">Our team will contact you directly to arrange '
        "freight and delivery. For anything urgent, reply to this email or message us "
        "on WhatsApp at <strong>+8801315-770099</strong>.</p>"
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

    body = (
        f"<p style=\"font-size:14px;margin:0 0 14px\">Dear {escape(details.get('fullName') or 'Customer')},</p>"
        f'<p style="font-size:14px;line-height:1.65;margin:0 0 8px">Please find attached the '
        f"delivery challan for your order against reference "
        f"<strong>{escape(confirmation.ref_number)}</strong>.</p>"
        '<p style="font-size:14px;line-height:1.65;margin:0 0 8px">Kindly check the items on '
        "receipt and let us know straight away if anything does not match.</p>"
        '<p style="font-size:13px;line-height:1.65;margin:18px 0 0;padding-top:16px;'
        'border-top:1px solid #e3e8ef">Any questions? Reply to this email, or message us on '
        "WhatsApp at <strong>+8801315-770099</strong>.</p>"
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


async def send_invoice(quotation, pdf_bytes: bytes | None = None) -> bool:
    """Sends the invoice for a confirmed order with the PDF attached."""
    details = quotation.details or {}
    confirmation = quotation.confirmation
    to = details.get("email")
    if not to:
        logger.warning("Quotation %s has no customer email; not sending.", quotation.id)
        return False
    if confirmation is None:
        logger.warning("Quotation %s has no confirmation; not sending.", quotation.id)
        return False

    invoice_ref = re.sub(r"/Q-?", "/I", confirmation.ref_number, flags=re.IGNORECASE)

    body = (
        f"<p style=\"font-size:14px;margin:0 0 14px\">Dear {escape(details.get('fullName') or 'Customer')},</p>"
        f'<p style="font-size:14px;line-height:1.65;margin:0 0 8px">Please find attached the '
        f"invoice for your confirmed order, reference "
        f"<strong>{escape(invoice_ref)}</strong>.</p>"
        + '<table style="width:100%;border-collapse:collapse;margin:18px 0 4px">'
        + _rows(
            [
                ("Invoice", invoice_ref),
                ("Amount", f"BDT {confirmation.grand_total:,.2f}"),
                ("Billed to", details.get("companyName") or details.get("fullName") or "—"),
            ]
        )
        + "</table>"
        + _terms_block(confirmation.terms or {})
        + '<p style="font-size:13px;line-height:1.65;margin:18px 0 0;padding-top:16px;'
        'border-top:1px solid #e3e8ef">Any questions about this invoice? Reply to this '
        "email, or message us on WhatsApp at <strong>+8801315-770099</strong>.</p>"
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
        f"Invoice {invoice_ref} — BDT {confirmation.grand_total:,.2f}",
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

    body = (
        f"<p style=\"font-size:14px;margin:0 0 14px\">Dear {escape(details.get('fullName') or 'Customer')},</p>"
        f'<p style="font-size:14px;line-height:1.65;margin:0 0 8px">Thank you — we have '
        f"received your payment against order "
        f"<strong>{escape(confirmation.ref_number)}</strong>. The money receipt is "
        f"attached for your records.</p>"
        + '<table style="width:100%;border-collapse:collapse;margin:18px 0 4px">'
        + _rows(
            [
                ("Receipt", receipt_ref),
                ("Amount received", f"BDT {confirmation.grand_total:,.2f}"),
                ("Against order", confirmation.ref_number),
            ]
        )
        + "</table>"
        + '<p style="font-size:13px;line-height:1.65;margin:18px 0 0;padding-top:16px;'
        'border-top:1px solid #e3e8ef">If anything on this receipt looks wrong, reply to '
        "this email, or message us on WhatsApp at <strong>+8801315-770099</strong>.</p>"
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
