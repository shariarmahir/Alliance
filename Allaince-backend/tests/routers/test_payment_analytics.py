"""The Overview's payment panel, against the same source as everything else.

An earlier pass made the Orders screen derive payment from the invoices
raised against an order, because a hand-set flag and a pile of receipts are
two answers to one question. The analytics and the receipt gate were not
carried across: both still read confirmation.payment_status, the stored
column nothing sets any more.

The visible symptom is a dashboard contradicting the table underneath it --
every row reading RECEIVED while "Received payments" reads zero.
"""

import base64

import pytest

from app.core.rate_limit import reset_in_memory_buckets
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.schemas.session import AdminSession


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    reset_in_memory_buckets()
    yield
    reset_in_memory_buckets()


QUOTE = {
    "items": [{"slug": "drive-1", "partNumber": "PN-A", "name": "Siemens Drive",
               "brand": "siemens", "image": "/i.jpg", "price": 100.0, "quantity": 10}],
    "details": {"fullName": "Ada", "email": "ada@example.com", "phone": "+8801700000000",
                "companyName": "Mahir Fabrics Ltd", "country": "Bangladesh",
                "preferredContact": "email", "leadTime": "standard"},
}
LINES = [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10, "unitPrice": 100.0}]
TERMS = {"payment": "50% advance", "delivery": "3-4 weeks", "offerValidity": "30 days",
         "vatAit": "Excluded", "warranty": "12 months"}


def _auth(client, role="super", **kwargs):
    client.cookies.set(
        ADMIN_SESSION_COOKIE,
        create_session_token(AdminSession(role=role, name="A", email="a@x.com", **kwargs)),
    )


async def _confirmed(client):
    qid = (await client.post("/api/quotations", json=QUOTE)).json()["id"]
    _auth(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": False, "lines": LINES, "terms": TERMS})
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})
    return qid


async def _invoice(client, qid, *, paid=0.0):
    inv = (await client.post("/api/admin/invoices",
                             json={"quotationId": qid, "lines": LINES})).json()
    await client.post(f"/api/admin/invoices/{inv['id']}/approve")
    if paid:
        await client.post(f"/api/admin/invoices/{inv['id']}/payments",
                          json={"amount": paid, "method": "bank", "reference": "TRX-1"})
    return inv


async def _payments(client, range_="month"):
    return (await client.get(f"/api/admin/analytics/payments?range={range_}")).json()


@pytest.mark.anyio
async def test_a_paid_invoice_shows_as_received_on_the_overview(client):
    """The screenshot. Both rows read RECEIVED; the panel read zero.

    The row is derived from the invoices. The panel was reading the stored
    payment_status column, which nothing writes any more, so it reported no
    money against orders that had been paid in full.
    """
    qid = await _confirmed(client)
    await _invoice(client, qid, paid=1000.0)

    # The order itself agrees the money arrived.
    order = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert order["confirmation"]["paymentStatus"] == "received"

    panel = await _payments(client)
    assert panel["received"] == pytest.approx(1000.0)
    assert panel["receivedCount"] == 1
    assert panel["pending"] == pytest.approx(0.0)
    assert panel["pendingCount"] == 0


@pytest.mark.anyio
async def test_an_unpaid_invoice_shows_as_pending(client):
    qid = await _confirmed(client)
    await _invoice(client, qid)

    panel = await _payments(client)
    assert panel["received"] == pytest.approx(0.0)
    assert panel["receivedCount"] == 0
    assert panel["pending"] == pytest.approx(1000.0)
    assert panel["pendingCount"] == 1


@pytest.mark.anyio
async def test_a_part_paid_invoice_splits_across_both_figures(client):
    """Neither side can carry the whole order: 400 in and 600 owed.

    The old flag could only say paid or not, so a part-paid order counted its
    full value on one side and nothing on the other -- overstating whichever
    it landed on by the amount of the other.
    """
    qid = await _confirmed(client)
    await _invoice(client, qid, paid=400.0)

    panel = await _payments(client)
    assert panel["received"] == pytest.approx(400.0)
    assert panel["pending"] == pytest.approx(600.0)
    # It is one order, counted once on each side rather than twice on either.
    assert panel["receivedCount"] == 1
    assert panel["pendingCount"] == 1


@pytest.mark.anyio
async def test_an_order_with_no_invoice_owes_nothing_yet(client):
    """Confirmed but never billed. Counting the order's value as owed would
    report a debt the customer has never been asked for."""
    qid = await _confirmed(client)

    panel = await _payments(client)
    assert panel["received"] == pytest.approx(0.0)
    assert panel["pending"] == pytest.approx(0.0)
    assert panel["pendingCount"] == 0


@pytest.mark.anyio
async def test_a_cancelled_invoice_stops_counting(client):
    """Withdrawn paperwork is not owed."""
    qid = await _confirmed(client)
    inv = (await client.post("/api/admin/invoices",
                             json={"quotationId": qid, "lines": LINES})).json()

    assert (await _payments(client))["pending"] == pytest.approx(1000.0)

    await client.patch(f"/api/admin/invoices/{inv['id']}/status",
                       json={"status": "cancelled"})
    assert (await _payments(client))["pending"] == pytest.approx(0.0)


@pytest.mark.anyio
async def test_the_panel_totals_match_the_orders_underneath(client):
    """The invariant the screenshot broke: the panel is the sum of the rows.

    Checked across a mixture rather than one order, because the failure being
    guarded against is a panel that disagrees with the table it sits above.
    """
    paid = await _confirmed(client)
    await _invoice(client, paid, paid=1000.0)
    part = await _confirmed(client)
    await _invoice(client, part, paid=250.0)
    unpaid = await _confirmed(client)
    await _invoice(client, unpaid)

    rows = [
        (await client.get(f"/api/admin/quotations/{q}")).json()["confirmation"]
        for q in (paid, part, unpaid)
    ]
    panel = await _payments(client)

    assert panel["received"] == pytest.approx(sum(r["amountPaid"] for r in rows))
    assert panel["pending"] == pytest.approx(sum(r["amountOutstanding"] for r in rows))


@pytest.mark.anyio
async def test_a_receipt_can_be_sent_once_the_invoice_is_paid(client, monkeypatch):
    """The same stale column gated the receipt email.

    An order paid in full through its invoices was refused a receipt, telling
    the admin to "mark the payment received" through a control that no longer
    exists.
    """
    from app.routers import admin_operations

    async def _sent(*args, **kwargs):
        return True

    monkeypatch.setattr(admin_operations.email_integration, "send_receipt", _sent)

    qid = await _confirmed(client)
    await _invoice(client, qid, paid=1000.0)

    response = await client.post(
        f"/api/admin/quotations/{qid}/receipt/email",
        json={"pdfBase64": base64.b64encode(b"%PDF-1.4 receipt").decode()},
    )
    assert response.status_code == 200


@pytest.mark.anyio
async def test_a_receipt_is_still_refused_when_nothing_was_paid(client):
    """A receipt asserts money arrived, so the gate itself must survive."""
    qid = await _confirmed(client)
    await _invoice(client, qid)

    response = await client.post(
        f"/api/admin/quotations/{qid}/receipt/email",
        json={"pdfBase64": base64.b64encode(b"%PDF-1.4 receipt").decode()},
    )
    assert response.status_code == 400
