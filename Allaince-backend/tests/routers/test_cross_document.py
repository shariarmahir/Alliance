"""The seam between the two documents.

Document 2 opens with a promise Document 1 never mentions:

  "The Invoice & Challan Management System should start from the Order
   Confirmed records so that all documents remain linked with the original
   Price Request, Quotation, and Customer Work Order/PO."

Everything tested so far stays inside one document. These tests attack the
join: what happens to that linkage when the quotation side changes underneath
documents that were built from it.
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
         "brand": "siemens", "image": "/i.jpg", "price": 100.0, "quantity": 10},
        {"slug": "plc-2", "partNumber": "PN-B", "name": "Omron PLC",
         "brand": "omron", "image": "/i.jpg", "price": 250.0, "quantity": 4},
    ],
    "details": {"fullName": "Ada Lovelace", "email": "ada@example.com",
                "phone": "+8801700000000", "companyName": "Mahir Fabrics Ltd",
                "country": "Bangladesh", "preferredContact": "email",
                "leadTime": "standard"},
}
LINES = [
    {"slug": "drive-1", "name": "Siemens Drive", "quantity": 10, "unitPrice": 100.0},
    {"slug": "plc-2", "name": "Omron PLC", "quantity": 4, "unitPrice": 250.0},
]
TERMS = {"payment": "50% advance", "delivery": "3-4 weeks", "offerValidity": "30 days",
         "vatAit": "As per govt rate", "warranty": "12 months"}


def _auth(client, role="super", **kwargs):
    client.cookies.set(
        ADMIN_SESSION_COOKIE,
        create_session_token(AdminSession(role=role, name="Admin", email="a@x.com", **kwargs)),
    )


async def _confirmed(client):
    qid = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": False, "lines": LINES, "terms": TERMS})
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})
    return qid


async def test_a_line_carrying_documents_cannot_be_dropped_from_the_order(client, db):
    """Item 12 revisions replace the confirmation's lines wholesale. Reducing
    a quantity below what was invoiced is refused -- but removing the line
    entirely is the same reduction, expressed by omission."""
    qid = await _confirmed(client)
    inv = await client.post("/api/admin/invoices", json={
        "quotationId": qid,
        "lines": [{"slug": "plc-2", "name": "Omron PLC", "quantity": 4,
                   "unitPrice": 250.0}]})
    assert inv.status_code == 201
    await client.post(f"/api/admin/invoices/{inv.json()['id']}/approve")

    # The revised PO drops the PLC line altogether.
    r = await client.post(
        f"/api/admin/quotations/{qid}/confirm",
        json={"confirm": True,
              "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                         "quantity": 10, "unitPrice": 100.0}],
              "terms": TERMS})
    assert r.status_code == 409


async def test_the_po_number_on_a_document_follows_the_order(client, db):
    """Document 2 requires invoices and challans to stay linked to the
    Customer Work Order/PO. The PO often arrives after the first invoice is
    raised, so an invoice created before it must still show it afterwards."""
    qid = await _confirmed(client)
    inv = (await client.post("/api/admin/invoices", json={
        "quotationId": qid,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10,
                   "unitPrice": 100.0}]})).json()
    assert inv["poNumber"] == ""

    await client.patch(f"/api/admin/quotations/{qid}/work-order",
                       json={"poNumber": "PO-2026-0091"})

    after = (await client.get(f"/api/admin/invoices/{inv['id']}")).json()
    assert after["poNumber"] == "PO-2026-0091"


async def test_a_delivered_order_reports_completed_delivery(client, db):
    """Section B's Completed: when the total ordered quantity has been
    delivered, the Work Order delivery status becomes Completed
    automatically -- across both lines, not just the first. The order's own
    stage only follows once payment is in too, so this raises and pays an
    invoice for the full amount alongside the delivery."""
    qid = await _confirmed(client)
    ch = (await client.post("/api/admin/challans", json={
        "quotationId": qid,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10},
                  {"slug": "plc-2", "name": "Omron PLC", "quantity": 4}]})).json()
    await client.post(f"/api/admin/challans/{ch['id']}/approve")
    await client.post(f"/api/admin/challans/{ch['id']}/dispatch",
                      json={"vehicleNumber": "DHK-1", "driverInfo": "Karim",
                            "receiverName": "Store", "remarks": ""})
    await client.post(f"/api/admin/challans/{ch['id']}/deliver")

    invoice = (await client.post("/api/admin/invoices", json={
        "quotationId": qid, "lines": LINES})).json()
    await client.post(f"/api/admin/invoices/{invoice['id']}/approve")
    await client.post(f"/api/admin/invoices/{invoice['id']}/payments",
                      json={"amount": 2000.0, "method": "bank", "reference": "TXN-1"})

    # MAX_STAGE is the last entry in DELIVERY_STAGES, not a fixed number:
    # asserting a literal here would break the moment a stage is added.
    from app.services import operations as ops
    q = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert q["confirmation"]["deliveryStage"] == ops.MAX_STAGE


async def test_cancelling_a_delivered_order_is_refused_end_to_end(client, db):
    """Section C keeps the whole chain under one transaction. An order whose
    goods are with the customer must not be removable from the Quotations
    screen -- the Remove button routes to the same status endpoint."""
    qid = await _confirmed(client)
    ch = (await client.post("/api/admin/challans", json={
        "quotationId": qid,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10}]})).json()
    await client.post(f"/api/admin/challans/{ch['id']}/approve")
    await client.post(f"/api/admin/challans/{ch['id']}/dispatch",
                      json={"vehicleNumber": "DHK-1", "driverInfo": "K",
                            "receiverName": "S", "remarks": ""})
    await client.post(f"/api/admin/challans/{ch['id']}/deliver")

    r = await client.patch(f"/api/admin/quotations/{qid}/status",
                           json={"status": "cancelled"})
    assert r.status_code == 409


async def test_history_shows_documents_from_both_sides(client, db):
    """Section C: complete traceability from the initial inquiry through to
    invoicing and delivery, in one place."""
    qid = await _confirmed(client)
    await client.post("/api/admin/invoices", json={
        "quotationId": qid,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10,
                   "unitPrice": 100.0}]})
    await client.post("/api/admin/challans", json={
        "quotationId": qid,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10}]})
    await client.patch(f"/api/admin/quotations/{qid}/work-order",
                       json={"poNumber": "PO-77"})

    h = (await client.get(f"/api/admin/quotations/{qid}/history")).json()
    kinds = [e["kind"] for e in h["events"]]
    for expected in ("request", "quotation", "confirmed", "invoice", "challan"):
        assert expected in kinds, f"{expected} missing from the chain"
    assert h["poNumber"] == "PO-77"


async def test_an_order_reports_its_delivery_completion(client, db):
    """Section B: "When the total ordered quantity has been delivered, the
    Work Order delivery status will automatically become Completed."

    delivery_stage carries Pending and Confirmed only -- it is the customer's
    tracker, not a fulfilment state. Nothing on the order said whether its
    goods had actually shipped, so the Orders screen could not show Completed
    at all. This exposes it, derived from the challans rather than stored, so
    it cannot disagree with the documents underneath it.
    """
    qid = await _confirmed(client)

    q = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert q["confirmation"]["deliveryComplete"] is False

    ch = (await client.post("/api/admin/challans", json={
        "quotationId": qid,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10}]})).json()
    await client.post(f"/api/admin/challans/{ch['id']}/approve")
    await client.post(f"/api/admin/challans/{ch['id']}/dispatch",
                      json={"vehicleNumber": "DHK-1", "driverInfo": "K",
                            "receiverName": "S", "remarks": ""})
    await client.post(f"/api/admin/challans/{ch['id']}/deliver")

    # One line delivered in full, the other untouched: not complete.
    q = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert q["confirmation"]["deliveryComplete"] is False

    rest = (await client.post("/api/admin/challans", json={
        "quotationId": qid,
        "lines": [{"slug": "plc-2", "name": "Omron PLC", "quantity": 4}]})).json()
    await client.post(f"/api/admin/challans/{rest['id']}/approve")
    await client.post(f"/api/admin/challans/{rest['id']}/dispatch",
                      json={"vehicleNumber": "DHK-2", "driverInfo": "R",
                            "receiverName": "S", "remarks": ""})
    await client.post(f"/api/admin/challans/{rest['id']}/deliver")

    q = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert q["confirmation"]["deliveryComplete"] is True
