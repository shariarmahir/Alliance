import types
from unittest.mock import patch

import pytest

from app.integrations import email as email_integration

# The whole sign-off, not just the name: the fixture customer used to share
# that name, so asserting it alone passed even with the block deleted.
_SIGN_OFF = "Best Regards,"


def _confirmation(**overrides):
    base = dict(
        ref_number="AIT/TA&E/Q-0001/2026",
        subject="Offer for HMI spares",
        issued_date="2026-08-22",
        tracking_id="TRK-1",
        grand_total=51250.0,
        terms={
            "payment": "100% Cash/Pay order.",
            "delivery": "From Ready Stock",
            "offerValidity": "07 days, From the Offer Date.",
            "vatAit": "Excluded.",
            "stock": "Available.",
            "installationCharge": "Free.",
            "warranty": "12 Months Warranty (From the date of delivery)",
        },
        lines=[
            {
                "name": "Mitsubishi GS2107 HMI",
                "partNumber": "GS2107-WTBD",
                "quantity": 2,
                "unit": "Pcs",
                "unitPrice": 18500.0,
                "total": 37000.0,
            },
            {
                "name": "Danfoss Brake Resistor",
                "partNumber": "MCF-107",
                "quantity": 1,
                "unit": "Pcs",
                "unitPrice": 14250.0,
                "total": 14250.0,
            },
        ],
    )
    base.update(overrides)
    return types.SimpleNamespace(**base)


def _quotation(confirmation, **detail_overrides):
    details = {
        "fullName": "Mahir Shariar",
        "email": "customer@example.com",
        "companyName": "TechLink Automation",
    }
    details.update(detail_overrides)
    return types.SimpleNamespace(id="q-1", details=details, confirmation=confirmation)


async def _render(quotation):
    """Captures the HTML that would be sent, without touching Resend."""
    captured: dict = {}

    async def fake_send(to, subject, html, attachments=None):
        captured.update(to=to, subject=subject, html=html, attachments=attachments)
        return True

    with patch.object(email_integration, "send_email", fake_send):
        await email_integration.send_quotation_issued(quotation, None)
    return captured


async def test_quotation_email_is_a_covering_letter_not_a_second_copy():
    """The body accompanies the PDF; it does not restate it.

    Line items, the terms table and the reference/date/prepared-for rows all
    used to be repeated in the body. Two copies of one document is two things
    that can disagree -- a revised attachment beside a stale body. The PDF is
    the record.
    """
    sent = await _render(_quotation(_confirmation()))
    html = sent["html"]

    # The letter itself.
    assert "Dear Mahir Shariar," in html
    assert "we are pleased to submit our best competitive offer" in html
    assert "Please find attached our price quotation" in html
    assert "long-term business relationship" in html
    assert _SIGN_OFF in html

    # The reference stays: it is what the customer quotes when replying.
    assert "AIT/TA&amp;E/Q-0001/2026" in html

    # None of the restated document survives.
    assert "Mitsubishi GS2107 HMI" not in html
    assert "GS2107-WTBD" not in html
    assert "Terms of this offer" not in html
    assert "12 Months Warranty (From the date of delivery)" not in html
    # The grand total belongs to the attachment and the subject line, not here.
    assert "51,250.00" not in html


async def test_admin_written_subject_line_survives():
    """Free text typed per quotation, saying something the PDF does not --
    unlike the tables removed around it, which only repeated the attachment."""
    sent = await _render(_quotation(_confirmation()))
    assert "Offer for HMI spares" in sent["html"]


async def test_quotation_email_subject_carries_reference_and_total():
    """A reference keeps the reply thread findable; the total lets the
    recipient triage without opening the attachment."""
    sent = await _render(_quotation(_confirmation()))
    assert "AIT/TA&E/Q-0001/2026" in sent["subject"]
    assert "51,250.00" in sent["subject"]


async def test_quotation_email_escapes_untrusted_text():
    """Product names and the offer subject are free text typed by an admin and
    echoed into a customer's inbox — they must never render as markup."""
    confirmation = _confirmation(
        subject="<script>alert('x')</script>",
        lines=[
            {
                "name": "<b>Injected</b>",
                "partNumber": "P&N",
                "quantity": 1,
                "unit": "Pcs",
                "unitPrice": 1.0,
                "total": 1.0,
            }
        ],
    )
    html = (await _render(_quotation(confirmation, companyName="A & B Co")))["html"]

    assert "<script>" not in html
    assert "<b>Injected</b>" not in html
    # The admin-written subject is still echoed into the body, so it is still
    # the thing that must arrive escaped rather than rendered.
    assert "&lt;script&gt;" in html


async def test_quotation_email_without_customer_address_is_not_sent():
    quotation = _quotation(_confirmation(), email="")
    with patch.object(email_integration, "send_email") as send:
        assert await email_integration.send_quotation_issued(quotation, None) is False
        send.assert_not_called()


@pytest.mark.parametrize("lines", [[], None])
async def test_quotation_email_survives_an_empty_line_list(lines):
    """A confirmation with no lines is degenerate but must not raise — the
    email should still deliver with its reference and total."""
    html = (await _render(_quotation(_confirmation(lines=lines))))["html"]
    # Escaped in the body, since the reference contains an ampersand.
    assert "AIT/TA&amp;E/Q-0001/2026" in html


async def _render_with(sender, *args, **kwargs):
    """Captures the HTML from any of the customer-facing senders."""
    captured: dict = {}

    async def fake_send(to, subject, html, attachments=None):
        captured.update(to=to, subject=subject, html=html, attachments=attachments)
        return True

    with patch.object(email_integration, "send_email", fake_send):
        await sender(*args, **kwargs)
    return captured


def _invoice(**overrides):
    base = dict(
        invoice_number="AIT/M/I-0001/2026",
        grand_total=500.0,
        amount_paid=0.0,
    )
    base.update(overrides)
    return types.SimpleNamespace(**base)


async def test_invoice_email_is_a_letter_not_a_restated_invoice():
    """The screenshot case. The body carried the invoice number, the amount,
    who it was billed to and the whole terms table -- every figure the PDF
    already stated, and one of them (the amount) was wrong whenever an order
    was part-invoiced."""
    quotation = _quotation(_confirmation())
    sent = await _render_with(
        email_integration.send_invoice, quotation, None, _invoice()
    )
    html = sent["html"]

    assert "Dear Mahir Shariar," in html
    assert "AIT/M/I-0001/2026" in html
    assert _SIGN_OFF in html

    # The duplicated document is gone.
    assert "Terms of this offer" not in html
    assert "Billed to" not in html
    assert "BDT 500.00" not in html
    assert "100% Cash/Pay order." not in html

    # But the subject still carries the figure, where it aids triage.
    assert "500.00" in sent["subject"]


async def test_challan_email_is_a_letter():
    quotation = _quotation(_confirmation())
    html = (await _render_with(email_integration.send_challan, quotation, None))["html"]

    assert "Dear Mahir Shariar," in html
    assert "your order has been dispatched" in html
    assert "AIT/TA&amp;E/Q-0001/2026" in html
    assert _SIGN_OFF in html
    assert "WhatsApp" not in html


async def test_receipt_email_is_a_letter():
    quotation = _quotation(_confirmation())
    html = (await _render_with(email_integration.send_receipt, quotation, None))["html"]

    assert "Dear Mahir Shariar," in html
    assert "acknowledge receipt of your payment" in html
    assert _SIGN_OFF in html
    # The receipt PDF states the amount; the body no longer repeats it.
    assert "51,250.00" not in html


async def test_order_confirmed_keeps_its_line_items():
    """The one customer email with no attachment. Here the items are the only
    record of what was ordered, not a second copy of one -- so removing them
    would lose information rather than de-duplicate it."""
    quotation = _quotation(_confirmation())
    html = (await _render_with(email_integration.send_order_confirmed, quotation))["html"]

    assert "Dear Mahir Shariar," in html
    assert "pleased to confirm your order" in html
    assert "Mitsubishi GS2107 HMI" in html
    assert "51,250.00" in html
    assert _SIGN_OFF in html


async def test_line_items_table_is_not_nested_inside_a_paragraph():
    """A <table> inside a <p> is markup email clients render however they
    like -- the browser closes the paragraph early and the layout breaks."""
    quotation = _quotation(_confirmation())
    html = (await _render_with(email_integration.send_order_confirmed, quotation))["html"]

    before = html.split("<table", 1)[0]
    assert before.rstrip().endswith("</p>")
