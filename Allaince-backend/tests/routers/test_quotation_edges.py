"""Adversarial tests for Document 1: the ways each item can break.

These do not re-check that features exist. They hunt for the states an admin
can actually reach in a working day that the happy path never visits.
"""

import pytest

from app.core.rate_limit import reset_in_memory_buckets
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.schemas.session import AdminSession


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    reset_in_memory_buckets()
    yield
    reset_in_memory_buckets()


QUOTE_PAYLOAD = {
    "items": [{"slug": "drive-1", "partNumber": "PN-A", "name": "Siemens Drive",
               "brand": "siemens", "image": "/i.jpg", "price": 100.0, "quantity": 10}],
    "details": {"fullName": "Ada Lovelace", "email": "ada@example.com",
                "phone": "+8801700000000", "companyName": "Mahir Fabrics Ltd",
                "country": "Bangladesh", "preferredContact": "email",
                "leadTime": "standard"},
}
LINES = [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10, "unitPrice": 100.0}]
TERMS = {"payment": "50% advance", "delivery": "3-4 weeks", "offerValidity": "30 days",
         "vatAit": "As per govt rate", "warranty": "12 months"}


def _auth(client, role="super", **kwargs):
    client.cookies.set(
        ADMIN_SESSION_COOKIE,
        create_session_token(AdminSession(role=role, name="Admin", email="a@x.com", **kwargs)),
    )


async def _pending(client):
    qid = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": False, "lines": LINES, "terms": TERMS})
    return qid


# --- Item 10: "successfully sent" ------------------------------------------


async def test_a_failed_email_leaves_the_quotation_in_pending(client, db, monkeypatch):
    """Item 10 says the status changes after the quotation "has been
    successfully sent". A mail failure that still flipped it to Submitted
    would leave an offer nobody chases, because it looks delivered."""
    qid = await _pending(client)

    import app.routers.admin_operations as admin_ops

    async def _fail(quotation, pdf_bytes=None):
        return False

    monkeypatch.setattr(admin_ops.email_integration, "send_quotation_issued", _fail)
    r = await client.post(f"/api/admin/quotations/{qid}/email")
    # An error, and the status left alone. Which error it is depends on why
    # the provider refused, which this test deliberately does not pin down.
    assert r.status_code >= 400

    after = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert after["status"] == "pending"


async def test_an_unprepared_request_cannot_be_emailed(client, db):
    """There is no quotation to attach yet -- sending would deliver an empty
    document over the company's name."""
    qid = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)

    r = await client.post(f"/api/admin/quotations/{qid}/email")
    assert r.status_code == 400


# --- Item 12: revise against the confirmed Work Order/PO -------------------


async def test_revising_a_confirmed_order_keeps_its_tracking_id(client, db):
    """Item 12 revisions happen after the customer holds a document. The ref
    and the tracking ID are both printed on it, so neither may move."""
    qid = await _pending(client)
    first = (await client.post(f"/api/admin/quotations/{qid}/confirm",
                               json={"confirm": True, "lines": LINES, "terms": TERMS})).json()
    ref = first["confirmation"]["refNumber"]
    tracking = first["confirmation"]["trackingId"]

    revised = (await client.post(
        f"/api/admin/quotations/{qid}/confirm",
        json={"confirm": True,
              "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                         "quantity": 3, "unitPrice": 90.0}],
              "terms": dict(TERMS, delivery="1 week")})).json()

    assert revised["confirmation"]["refNumber"] == ref
    assert revised["confirmation"]["trackingId"] == tracking
    assert revised["confirmation"]["grandTotal"] == 270.0
    assert revised["confirmation"]["terms"]["delivery"] == "1 week"


async def test_revising_down_below_what_was_already_invoiced_is_refused(client, db):
    """Item 12 allows the confirmed order to be corrected to the PO. But an
    order already invoiced for 10 cannot be revised down to 3: the invoice
    would then bill more than the order contains, and every balance on the
    record goes negative."""
    qid = await _pending(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})
    inv = await client.post("/api/admin/invoices", json={
        "quotationId": qid, "lines": LINES})
    assert inv.status_code == 201
    await client.post(f"/api/admin/invoices/{inv.json()['id']}/approve")

    r = await client.post(
        f"/api/admin/quotations/{qid}/confirm",
        json={"confirm": True,
              "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                         "quantity": 3, "unitPrice": 100.0}],
              "terms": TERMS})
    assert r.status_code == 409


# --- Item 13: the PO ------------------------------------------------------


async def test_filing_a_po_number_does_not_wipe_an_attached_document(client, db):
    """The number often arrives by email before the signed PDF follows, and
    sometimes gets corrected afterwards. Saving a corrected number must not
    detach the document already filed against the order."""
    qid = await _pending(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})

    files = {"file": ("po.pdf", b"%PDF-1.4 fake", "application/pdf")}
    up = await client.post(f"/api/admin/quotations/{qid}/work-order",
                           files=files, data={"po_number": "PO-1"})
    assert up.status_code == 200, up.text
    assert up.json()["poDocumentUrl"]

    fixed = await client.patch(f"/api/admin/quotations/{qid}/work-order",
                               json={"poNumber": "PO-2"})
    assert fixed.status_code == 200
    assert fixed.json()["poNumber"] == "PO-2"
    assert fixed.json()["poDocumentUrl"], "the attached PO document was lost"


# --- Item 14: the record remains available --------------------------------


async def test_history_survives_a_revision(client, db):
    """Item 14 requires the original request, the submitted quotation AND the
    revised/final quotation to remain available. A revision that overwrites
    the confirmation must not empty the history."""
    qid = await _pending(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True,
                            "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                                       "quantity": 5, "unitPrice": 100.0}],
                            "terms": TERMS})

    h = (await client.get(f"/api/admin/quotations/{qid}/history")).json()
    kinds = [e["kind"] for e in h["events"]]
    assert "request" in kinds
    assert "quotation" in kinds
    assert "confirmed" in kinds


async def test_revising_up_and_sideways_still_works_after_invoicing(client, db):
    """The guard protects committed quantities without freezing item 12. An
    order invoiced for 10 can still be raised to 15, and its prices and terms
    corrected freely -- only reducing below 10 is refused."""
    qid = await _pending(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})
    inv = await client.post("/api/admin/invoices",
                            json={"quotationId": qid, "lines": LINES})
    await client.post(f"/api/admin/invoices/{inv.json()['id']}/approve")

    up = await client.post(
        f"/api/admin/quotations/{qid}/confirm",
        json={"confirm": True,
              "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                         "quantity": 15, "unitPrice": 85.0}],
              "terms": dict(TERMS, payment="Net 30")})
    assert up.status_code == 200, up.text
    c = up.json()["confirmation"]
    assert c["lines"][0]["quantity"] == 15
    assert c["lines"][0]["unitPrice"] == 85.0      # re-pricing stays open
    assert c["terms"]["payment"] == "Net 30"

    # Exactly at the committed quantity is allowed -- it is not below it.
    same = await client.post(
        f"/api/admin/quotations/{qid}/confirm",
        json={"confirm": True, "lines": LINES, "terms": TERMS})
    assert same.status_code == 200


async def test_a_cancelled_invoice_releases_the_floor(client, db):
    """A withdrawn document is not a commitment. Once its invoice is
    cancelled, the line can be revised down again."""
    qid = await _pending(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})
    inv = (await client.post("/api/admin/invoices",
                             json={"quotationId": qid, "lines": LINES})).json()

    blocked = await client.post(
        f"/api/admin/quotations/{qid}/confirm",
        json={"confirm": True,
              "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                         "quantity": 2, "unitPrice": 100.0}],
              "terms": TERMS})
    assert blocked.status_code == 409

    await client.patch(f"/api/admin/invoices/{inv['id']}/status",
                       json={"status": "cancelled"})

    now_ok = await client.post(
        f"/api/admin/quotations/{qid}/confirm",
        json={"confirm": True,
              "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                         "quantity": 2, "unitPrice": 100.0}],
              "terms": TERMS})
    assert now_ok.status_code == 200
    assert now_ok.json()["confirmation"]["lines"][0]["quantity"] == 2
