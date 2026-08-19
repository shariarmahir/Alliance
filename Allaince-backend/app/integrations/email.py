import logging
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
      {escape(settings.resend_from_email)} &middot; +8801713-116019
    </div>
  </div>
</body></html>"""


def _rows(pairs: list[tuple[str, str]]) -> str:
    return "".join(
        f'<tr><td style="padding:6px 12px 6px 0;color:#667085;font-size:13px">{escape(k)}</td>'
        f'<td style="padding:6px 0;font-size:13px"><strong>{escape(str(v))}</strong></td></tr>'
        for k, v in pairs
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

    tracking_url = f"{settings.public_site_url.rstrip('/')}/track/{confirmation.tracking_id}"
    body = (
        f"<p style=\"font-size:14px\">Dear {escape(details.get('fullName') or 'Customer')},</p>"
        f'<p style="font-size:14px">Thank you for your enquiry. Our offer is attached, '
        f"and the details are summarised below.</p>"
        f'<table style="width:100%;border-collapse:collapse;margin-top:12px">'
        f"{_rows([('Reference', confirmation.ref_number), ('Issued', str(confirmation.issued_date)), ('Grand total', f'BDT {confirmation.grand_total:,.2f}')])}"
        f"</table>"
        f'<p style="margin-top:20px"><a href="{escape(tracking_url)}" '
        f'style="display:inline-block;background:#007DCC;color:#fff;padding:10px 18px;'
        f'border-radius:6px;text-decoration:none;font-size:14px">Track your order</a></p>'
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
        to, f"Your quotation {confirmation.ref_number}", _shell("Your quotation", body), attachments
    )
