"""The client's two documents, walked end to end exactly as written.

The other billing tests check features in isolation. These follow the
Recommended Workflow arrow by arrow and assert the state after every step,
because a system can pass every individual check and still fail to carry an
order from Order Confirmed through to Completed.
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
    "details": {
        "fullName": "Ada Lovelace", "email": "ada@example.com",
        "phone": "+8801700000000", "companyName": "Mahir Fabrics Ltd",
        "country": "Bangladesh", "preferredContact": "email",
        "leadTime": "standard",
    },
}


def _auth(client, role="super", **kwargs):
    session = AdminSession(role=role, name="Admin", email="a@x.com", **kwargs)
    client.cookies.set(ADMIN_SESSION_COOKIE, create_session_token(session))


async def _order_confirmed(client):
    """Price Request -> Quotation -> Order Confirmed."""
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "lines": [
            {"slug": "drive-1", "name": "Siemens Drive", "quantity": 10, "unitPrice": 100.0},
            {"slug": "plc-2", "name": "Omron PLC", "quantity": 4, "unitPrice": 250.0},
        ]},
    )
    assert r.status_code == 200, r.text
    return quotation_id


# ---------------------------------------------------------------------------
# Section A, the whole arrow chain:
# Order Confirmed -> Prepare Invoice -> Save Draft -> Pending -> Review/Edit
# -> Approve -> Generate Invoice -> Send/Print -> Submitted -> Payment Status
# -> Completed
# ---------------------------------------------------------------------------


async def test_section_a_invoice_end_to_end(client, db, monkeypatch):
    quotation_id = await _order_confirmed(client)

    # -- item 3: the confirmed order's data is available to load -----------
    balances = (await client.get(
        f"/api/admin/quotations/{quotation_id}/balances"
    )).json()
    assert {b["slug"] for b in balances} == {"drive-1", "plc-2"}
    assert [b["uninvoiced"] for b in balances] == [10, 4]

    # -- items 4-7: prepare, with every calculation the PDF lists ----------
    created = await client.post("/api/admin/invoices", json={
        "quotationId": quotation_id,
        "lines": [
            {"slug": "drive-1", "name": "Siemens Drive", "quantity": 10, "unitPrice": 100.0},
            {"slug": "plc-2", "name": "Omron PLC", "quantity": 4, "unitPrice": 250.0},
        ],
        "discount": 200.0, "taxRate": 15.0, "otherCharges": 300.0,
    })
    assert created.status_code == 201, created.text
    inv = created.json()

    assert inv["lines"][0]["total"] == 1000.0          # Item Amount
    assert inv["lines"][1]["total"] == 1000.0
    assert inv["subtotal"] == 2000.0                   # Subtotal
    assert inv["discount"] == 200.0                    # Discount
    assert inv["taxAmount"] == 270.0                   # VAT on 2000-200
    assert inv["otherCharges"] == 300.0                # Other Charges
    assert inv["grandTotal"] == 2370.0                 # Grand Total

    # -- items 8-10: saved as Pending, with no number issued ---------------
    assert inv["status"] == "pending"
    assert inv["invoiceNumber"] is None
    listed = (await client.get("/api/admin/invoices?status=pending")).json()
    assert any(i["id"] == inv["id"] for i in listed)

    # -- items 11-13: review and correct before approval -------------------
    edited = await client.patch(f"/api/admin/invoices/{inv['id']}", json={"discount": 100.0})
    assert edited.status_code == 200
    assert edited.json()["grandTotal"] == 2485.0       # recalculated, not stale

    # Preview/Print is available on the draft too.
    assert (await client.get(f"/api/admin/invoices/{inv['id']}/pdf")).status_code in (200, 503)

    # -- items 14-16: approve assigns the final Number and Date ------------
    approved = (await client.post(f"/api/admin/invoices/{inv['id']}/approve")).json()
    assert approved["invoiceNumber"] is not None
    assert approved["invoiceDate"] != ""

    # No silent edits once the customer holds that number.
    assert (await client.patch(
        f"/api/admin/invoices/{inv['id']}", json={"discount": 0.0}
    )).status_code == 409

    # -- items 17-19: submit, then Submitted -------------------------------
    # Invoices go to the customer outside this system, so Submit records that
    # it has gone out rather than sending anything.
    submitted = await client.post(f"/api/admin/invoices/{inv['id']}/submit")
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"
    assert submitted.json()["invoiceNumber"] == approved["invoiceNumber"]

    # -- items 20-22: Unpaid -> Partially Paid -> Paid ---------------------
    part = (await client.post(f"/api/admin/invoices/{inv['id']}/payments", json={
        "amount": 1000.0, "method": "bank", "reference": "TXN-1",
    })).json()
    assert part["status"] == "partially_paid"
    assert part["amountPaid"] == 1000.0
    assert part["grandTotal"] - part["amountPaid"] == 1485.0   # outstanding

    full = (await client.post(f"/api/admin/invoices/{inv['id']}/payments", json={
        "amount": 1485.0, "method": "cash", "reference": "TXN-2",
    })).json()
    assert full["status"] == "paid"
    assert len(full["payments"]) == 2          # each receipt kept, per item 22

    # -- items 23-24: Completed -------------------------------------------
    done = await client.patch(
        f"/api/admin/invoices/{inv['id']}/status", json={"status": "completed"}
    )
    assert done.status_code == 200
    assert done.json()["status"] == "completed"

    # Still readable afterwards, "for future documentation and audit".
    assert (await client.get(f"/api/admin/invoices/{inv['id']}")).status_code == 200


# ---------------------------------------------------------------------------
# Section B, including the case the PDF calls out as "especially important":
# one Work Order delivered through multiple Challans.
# ---------------------------------------------------------------------------


async def test_section_b_challan_end_to_end_across_two_deliveries(client, db):
    quotation_id = await _order_confirmed(client)

    # -- FIRST CHALLAN: a partial delivery ---------------------------------
    first = await client.post("/api/admin/challans", json={
        "quotationId": quotation_id,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 6}],
        "deliveryAddress": "Mahir Fabrics Ltd\nPhone: +8801700000000\nBangladesh",
    })
    assert first.status_code == 201, first.text
    c1 = first.json()
    assert c1["status"] == "pending"
    assert c1["challanNumber"] is None

    # item 8: Order -> Previous Delivered -> Current -> Balance
    bal = {b["slug"]: b for b in (await client.get(
        f"/api/admin/quotations/{quotation_id}/balances"
    )).json()}
    assert bal["drive-1"]["ordered"] == 10
    assert bal["drive-1"]["delivered"] == 6
    assert bal["drive-1"]["balance"] == 4

    a1 = (await client.post(f"/api/admin/challans/{c1['id']}/approve")).json()
    assert a1["challanNumber"] is not None
    assert a1["challanDate"] != ""

    # Dispatch records all five fields the PDF names.
    d1 = (await client.post(f"/api/admin/challans/{c1['id']}/dispatch", json={
        "vehicleNumber": "DHK-METRO-1234",
        "driverInfo": "Karim Uddin, 01711-000000",
        "receiverName": "Store Manager",
        "remarks": "Handle with care",
    })).json()
    assert d1["status"] == "dispatched"
    assert d1["vehicleNumber"] == "DHK-METRO-1234"
    assert d1["driverInfo"].startswith("Karim")
    assert d1["receiverName"] == "Store Manager"
    assert d1["remarks"] == "Handle with care"
    assert d1["dispatchedAt"] is not None       # the Delivery Date

    delivered1 = (await client.post(f"/api/admin/challans/{c1['id']}/deliver")).json()
    assert delivered1["status"] == "delivered"

    # -- Partial Delivery: the remainder stays available -------------------
    bal = {b["slug"]: b for b in (await client.get(
        f"/api/admin/quotations/{quotation_id}/balances"
    )).json()}
    assert bal["drive-1"]["balance"] == 4
    assert bal["plc-2"]["balance"] == 4

    # ...and over-delivering that remainder is refused.
    over = await client.post("/api/admin/challans", json={
        "quotationId": quotation_id,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 5}],
    })
    assert over.status_code == 400

    # -- SECOND CHALLAN: the rest of the order -----------------------------
    second = await client.post("/api/admin/challans", json={
        "quotationId": quotation_id,
        "lines": [
            {"slug": "drive-1", "name": "Siemens Drive", "quantity": 4},
            {"slug": "plc-2", "name": "Omron PLC", "quantity": 4},
        ],
    })
    assert second.status_code == 201, second.text
    c2 = second.json()

    await client.post(f"/api/admin/challans/{c2['id']}/approve")
    await client.post(f"/api/admin/challans/{c2['id']}/dispatch", json={
        "vehicleNumber": "DHK-METRO-5678", "driverInfo": "Rahim",
        "receiverName": "Store Manager", "remarks": "",
    })
    final = await client.post(f"/api/admin/challans/{c2['id']}/deliver")
    assert final.status_code == 200
    assert final.json()["status"] == "delivered"

    # Two challan numbers against one Work Order, both distinct.
    a2 = (await client.get(f"/api/admin/challans/{c2['id']}")).json()
    assert a2["challanNumber"] != a1["challanNumber"]

    # -- Completed: every line delivered in full ---------------------------
    bal = {b["slug"]: b for b in (await client.get(
        f"/api/admin/quotations/{quotation_id}/balances"
    )).json()}
    assert all(b["balance"] == 0 for b in bal.values())


# ---------------------------------------------------------------------------
# Section C: one connected transaction, from price request to completion.
# ---------------------------------------------------------------------------


async def test_section_c_every_document_stays_linked(client, db):
    quotation_id = await _order_confirmed(client)

    invoice = (await client.post("/api/admin/invoices", json={
        "quotationId": quotation_id,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10,
                   "unitPrice": 100.0}],
    })).json()
    challan = (await client.post("/api/admin/challans", json={
        "quotationId": quotation_id,
        "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10}],
    })).json()

    # Both documents carry the customer and the quotation reference.
    for doc in (invoice, challan):
        assert doc["customerName"] == "Mahir Fabrics Ltd"
        assert doc["refNumber"]

    # Order History is the chain, in one place.
    history = (await client.get(
        f"/api/admin/quotations/{quotation_id}/history"
    )).json()
    kinds = [e["kind"] for e in history["events"]]
    assert "request" in kinds        # Price Request
    assert "quotation" in kinds      # Quotation
    assert "confirmed" in kinds      # Order Confirmed
    assert "invoice" in kinds        # Invoice
    assert "challan" in kinds        # Challan
    assert history["customerName"] == "Mahir Fabrics Ltd"

    # Filtering by order returns only this order's documents.
    mine = (await client.get(f"/api/admin/invoices?quotationId={quotation_id}")).json()
    assert [i["id"] for i in mine] == [invoice["id"]]
