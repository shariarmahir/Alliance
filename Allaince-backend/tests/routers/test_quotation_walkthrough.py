"""Document 1 walked end to end, exactly as the client wrote it.

Inbox -> View Request -> Prepare Quotation -> Save -> Pending -> Review/Edit
-> Send E-mail -> Submitted -> Customer Confirmation -> Verify/Revise
-> Upload Work Order/PO -> Order Confirmed -> Documentation & Record

The existing operations tests check these features one at a time. These follow
the Recommended Workflow in sequence, because a system can pass every
individual check and still fail to carry a request from Inbox to Confirmed.
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
    "items": [
        {"slug": "drive-1", "partNumber": "PN-A", "name": "Siemens Drive",
         "brand": "siemens", "image": "/i.jpg", "price": 100.0, "quantity": 10,
         "specifications": "3-phase, 400V"},
    ],
    "details": {
        "fullName": "Ada Lovelace", "email": "ada@example.com",
        "phone": "+8801700000000", "companyName": "Mahir Fabrics Ltd",
        "country": "Bangladesh", "preferredContact": "email",
        "leadTime": "standard", "notes": "Needed before Eid",
    },
}

TERMS = {
    "payment": "50% advance, balance on delivery",
    "delivery": "3-4 weeks from PO",
    "offerValidity": "30 days",
    "vatAit": "As per government rate",
    "warranty": "12 months",
}


def _auth(client, role="super", **kwargs):
    session = AdminSession(role=role, name="Admin", email="a@x.com", **kwargs)
    client.cookies.set(ADMIN_SESSION_COOKIE, create_session_token(session))


async def test_document_one_end_to_end(client, db, monkeypatch):
    # -- item 1: a new price request lands in the Inbox --------------------
    created = await client.post("/api/quotations", json=QUOTE_PAYLOAD)
    assert created.status_code == 201, created.text
    quotation_id = created.json()["id"]

    _auth(client)
    inbox = (await client.get("/api/admin/quotations?status=inbox")).json()
    assert any(q["id"] == quotation_id for q in inbox)

    # -- item 2: View shows the complete request ---------------------------
    detail = (await client.get(f"/api/admin/quotations/{quotation_id}")).json()
    assert detail["details"]["companyName"] == "Mahir Fabrics Ltd"
    assert detail["details"]["fullName"] == "Ada Lovelace"
    assert detail["items"][0]["name"] == "Siemens Drive"
    assert detail["items"][0]["quantity"] == 10

    # -- items 3-4: Prepare, then Save moves it to Pending automatically ---
    prepared = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={
            "confirm": False,
            "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                       "quantity": 10, "unitPrice": 120.0}],
            "terms": TERMS,
            "subject": "Quotation for Siemens Drives",
        },
    )
    assert prepared.status_code == 200, prepared.text
    q = prepared.json()
    assert q["status"] == "pending"
    assert q["confirmation"]["terms"]["payment"].startswith("50%")
    assert q["confirmation"]["terms"]["offerValidity"] == "30 days"
    assert q["confirmation"]["lines"][0]["unitPrice"] == 120.0

    pending = (await client.get("/api/admin/quotations?status=pending")).json()
    assert any(x["id"] == quotation_id for x in pending)

    # -- items 5-7: from Pending, View and Edit before submission ----------
    revised = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={
            "confirm": False,
            "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                       "quantity": 10, "unitPrice": 115.0}],
            "terms": dict(TERMS, delivery="2-3 weeks from PO"),
        },
    )
    assert revised.status_code == 200
    assert revised.json()["confirmation"]["lines"][0]["unitPrice"] == 115.0
    assert revised.json()["confirmation"]["terms"]["delivery"].startswith("2-3")
    assert revised.json()["status"] == "pending"

    # -- item 8: generate/preview the Formal Quotation --------------------
    assert (await client.get(
        f"/api/admin/quotations/{quotation_id}/pdf"
    )).status_code in (200, 503)

    # -- items 9-10: Send E-mail, then Submitted automatically -------------
    import app.routers.admin_operations as admin_ops
    sent = {}

    async def _fake_send(quotation, pdf_bytes=None):
        sent["to"] = (quotation.details or {}).get("email")
        return True

    monkeypatch.setattr(
        admin_ops.email_integration, "send_quotation_issued", _fake_send
    )
    emailed = await client.post(f"/api/admin/quotations/{quotation_id}/email")
    assert emailed.status_code == 200, emailed.text
    assert sent["to"] == "ada@example.com"

    after = (await client.get(f"/api/admin/quotations/{quotation_id}")).json()
    assert after["status"] == "submitted"
    submitted = (await client.get("/api/admin/quotations?status=submitted")).json()
    assert any(x["id"] == quotation_id for x in submitted)

    # -- items 11-12: customer confirms, with revised commercial terms ----
    confirmed = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={
            "confirm": True,
            "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                       "quantity": 8, "unitPrice": 110.0}],
            "terms": dict(TERMS, payment="30% advance, balance on delivery"),
        },
    )
    assert confirmed.status_code == 200, confirmed.text
    c = confirmed.json()
    assert c["status"] == "confirmed"
    assert c["confirmation"]["lines"][0]["quantity"] == 8
    assert c["confirmation"]["lines"][0]["unitPrice"] == 110.0
    assert c["confirmation"]["terms"]["payment"].startswith("30%")
    assert c["confirmation"]["refNumber"]

    # -- item 13: record the customer's Work Order / PO -------------------
    wo = await client.patch(
        f"/api/admin/quotations/{quotation_id}/work-order",
        json={"poNumber": "PO-2026-0091"},
    )
    assert wo.status_code == 200, wo.text
    assert wo.json()["poNumber"] == "PO-2026-0091"

    # -- item 14: the complete history remains available ------------------
    history = (await client.get(
        f"/api/admin/quotations/{quotation_id}/history"
    )).json()
    kinds = [e["kind"] for e in history["events"]]
    assert "request" in kinds
    assert "quotation" in kinds
    assert "email" in kinds
    assert "confirmed" in kinds
    assert history["poNumber"] == "PO-2026-0091"

    conf_list = (await client.get("/api/admin/quotations?status=confirmed")).json()
    assert any(x["id"] == quotation_id for x in conf_list)


# ---------------------------------------------------------------------------
# Item 14 says the confirmed record must remain available "for future
# documentation, reference, tracking, and audit purposes". A status change
# that erases it is the one way that promise can be broken silently.
# ---------------------------------------------------------------------------


async def _confirmed_with_documents(client):
    """A confirmed order that has already been invoiced and shipped."""
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "terms": TERMS,
              "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                         "quantity": 10, "unitPrice": 100.0}]},
    )
    invoice = (await client.post("/api/admin/invoices", json={
        "quotationId": quotation_id,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                   "quantity": 10, "unitPrice": 100.0}],
    })).json()
    challan = (await client.post("/api/admin/challans", json={
        "quotationId": quotation_id,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10}],
    })).json()
    return quotation_id, invoice, challan


async def test_a_confirmed_order_with_documents_cannot_be_sent_back(client, db):
    """Moving a confirmed order back to Inbox deletes its confirmation --
    and the invoice and challan raised against it reference a quotation that
    no longer has the lines, prices or reference they were built from."""
    quotation_id, _, _ = await _confirmed_with_documents(client)

    r = await client.patch(
        f"/api/admin/quotations/{quotation_id}/status", json={"status": "inbox"}
    )
    assert r.status_code == 409


async def test_a_confirmed_order_with_documents_cannot_be_cancelled(client, db):
    """Same erasure, reached by the Cancel button. The invoice may already be
    with the customer and the goods already shipped."""
    quotation_id, _, _ = await _confirmed_with_documents(client)

    r = await client.patch(
        f"/api/admin/quotations/{quotation_id}/status", json={"status": "cancelled"}
    )
    assert r.status_code == 409


async def test_a_confirmed_order_with_no_documents_can_still_be_cancelled(client, db):
    """The guard must protect real paperwork without freezing an order that
    was confirmed by mistake and has nothing raised against it yet."""
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "terms": TERMS,
              "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                         "quantity": 10, "unitPrice": 100.0}]},
    )

    r = await client.patch(
        f"/api/admin/quotations/{quotation_id}/status", json={"status": "cancelled"}
    )
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"
