import types
from unittest.mock import patch

import pytest

from app.integrations import email as email_integration


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
        "fullName": "Md Nurul Islam",
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


async def test_quotation_email_itemises_every_line():
    """The PDF is the contractual document, but it must not be the only place
    a customer can see what was quoted — many read mail on a phone."""
    sent = await _render(_quotation(_confirmation()))
    html = sent["html"]

    assert "Mitsubishi GS2107 HMI" in html
    assert "GS2107-WTBD" in html
    assert "Danfoss Brake Resistor" in html
    assert "MCF-107" in html
    # Grand total, formatted with separators rather than a bare float.
    assert "51,250.00" in html


async def test_quotation_email_lists_the_offer_terms():
    sent = await _render(_quotation(_confirmation()))
    html = sent["html"]

    assert "07 days, From the Offer Date." in html
    assert "12 Months Warranty (From the date of delivery)" in html
    assert "Excluded." in html


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
    assert "A &amp; B Co" in html


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
