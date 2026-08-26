"""One order, one payment position.

The Orders screen carried its own payment_status, set by hand. Invoices
carried real receipts with amounts, dates, methods and references. Neither
knew about the other, so an order fully paid through its invoices still read
PENDING on Orders, and an order marked RECEIVED there could have unpaid
invoices behind it.
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


async def _invoice(client, qid, *, approve=True):
    inv = (await client.post("/api/admin/invoices",
                             json={"quotationId": qid, "lines": LINES})).json()
    if approve:
        await client.post(f"/api/admin/invoices/{inv['id']}/approve")
    return inv


async def test_paying_an_invoice_settles_the_order(client, db):
    """The receipt is recorded against the invoice; the order must reflect it
    without anyone setting a second status by hand."""
    qid = await _confirmed(client)
    inv = await _invoice(client, qid)

    before = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert before["confirmation"]["paymentStatus"] == "pending"

    await client.post(f"/api/admin/invoices/{inv['id']}/payments",
                      json={"amount": 1000.0, "method": "bank", "reference": "TXN-1"})

    after = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert after["confirmation"]["paymentStatus"] == "received"


async def test_a_part_payment_leaves_the_order_unsettled(client, db):
    qid = await _confirmed(client)
    inv = await _invoice(client, qid)

    await client.post(f"/api/admin/invoices/{inv['id']}/payments",
                      json={"amount": 400.0, "method": "cash"})

    after = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert after["confirmation"]["paymentStatus"] == "pending"
    assert after["confirmation"]["amountPaid"] == 400.0
    assert after["confirmation"]["amountOutstanding"] == 600.0


async def test_the_order_reports_what_its_invoices_add_up_to(client, db):
    """The figures the Orders screen shows come from the invoices, so the two
    screens cannot disagree about how much has been received."""
    qid = await _confirmed(client)
    inv = await _invoice(client, qid)
    await client.post(f"/api/admin/invoices/{inv['id']}/payments", json={"amount": 250.0})
    await client.post(f"/api/admin/invoices/{inv['id']}/payments", json={"amount": 150.0})

    order = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert order["confirmation"]["amountPaid"] == 400.0
    assert order["confirmation"]["amountInvoiced"] == 1000.0
    assert order["confirmation"]["amountOutstanding"] == 600.0


async def test_an_order_with_no_invoice_reports_nothing_received(client, db):
    """Nothing has been billed, so nothing can have been paid -- the order
    must not read as settled just because no invoice contradicts it."""
    qid = await _confirmed(client)
    order = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert order["confirmation"]["paymentStatus"] == "pending"
    assert order["confirmation"]["amountPaid"] == 0.0
    assert order["confirmation"]["amountInvoiced"] == 0.0
