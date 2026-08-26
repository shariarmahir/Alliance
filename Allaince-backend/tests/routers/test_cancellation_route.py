"""Cancelling one order, end to end.

Two screens offer to withdraw the same order -- "Remove" on Quotations and
"Cancel" on Orders -- and both PATCH the same status route. The route refuses
while invoices or challans stand against the order, which is correct: an
approved invoice pointing at a deleted confirmation is an accounting hole.

What was missing is the way out. The refusal named the blocking documents but
nothing let an admin act on it, so a confirmed order that had ever been
invoiced could never be withdrawn from either screen. These tests pin the
refusal, the route through it, and the fact that both screens behave alike.
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


async def _cancel(client, qid):
    return await client.patch(f"/api/admin/quotations/{qid}/status",
                              json={"status": "cancelled"})


@pytest.mark.anyio
async def test_confirmed_order_with_no_documents_cancels(client):
    """The plain case still works -- the guard must not block everything."""
    qid = await _confirmed(client)
    assert (await _cancel(client, qid)).status_code == 200

    row = (await client.get(f"/api/admin/quotations/{qid}")).json()
    assert row["status"] == "cancelled"
    assert row["confirmation"] is None


@pytest.mark.anyio
async def test_invoiced_order_is_refused_and_names_the_blocker(client):
    """The screenshot's failure. Refusing is right; saying why is the point."""
    qid = await _confirmed(client)
    inv = (await client.post("/api/admin/invoices",
                             json={"quotationId": qid, "lines": LINES})).json()
    await client.post(f"/api/admin/invoices/{inv['id']}/approve")

    response = await _cancel(client, qid)
    assert response.status_code == 409
    detail = response.json()["detail"]
    # The count has to be in the message: "cancel the documents first" is not
    # actionable if the admin cannot tell which documents, or how many.
    assert "1 invoice" in detail
    assert "0 challan" in detail


@pytest.mark.anyio
async def test_cancelling_the_invoice_unblocks_the_order(client):
    """The route through the refusal. Without this the order is a dead end."""
    qid = await _confirmed(client)
    inv = (await client.post("/api/admin/invoices",
                             json={"quotationId": qid, "lines": LINES})).json()
    await client.post(f"/api/admin/invoices/{inv['id']}/approve")
    assert (await _cancel(client, qid)).status_code == 409

    cancelled = await client.patch(f"/api/admin/invoices/{inv['id']}/status",
                                   json={"status": "cancelled"})
    assert cancelled.status_code == 200

    # A withdrawn invoice is not paperwork to protect, so the order frees up.
    assert (await _cancel(client, qid)).status_code == 200
    assert (await client.get(f"/api/admin/quotations/{qid}")).json()["status"] == "cancelled"


@pytest.mark.anyio
async def test_challan_blocks_cancellation_too(client):
    """Delivery paperwork counts the same as billing paperwork."""
    qid = await _confirmed(client)
    challan = (await client.post("/api/admin/challans",
                                 json={"quotationId": qid, "lines": LINES})).json()

    response = await _cancel(client, qid)
    assert response.status_code == 409
    assert "1 challan" in response.json()["detail"]

    await client.patch(f"/api/admin/challans/{challan['id']}/status",
                       json={"status": "cancelled"})
    assert (await _cancel(client, qid)).status_code == 200


@pytest.mark.anyio
async def test_paid_invoice_says_the_order_cannot_be_cancelled(client):
    """The screenshot's real state: COMPLETED / RECEIVED.

    A paid invoice cannot be cancelled -- receipts are facts and a cancelled
    document is not where they reconcile. So the order behind it can never be
    withdrawn. That is a defensible rule, but it used to surface as a button
    that silently did nothing. The refusal must say the order cannot be
    cancelled at all, not "cancel those documents first", which is a circle:
    the invoice refuses, and the admin has learnt nothing.
    """
    qid = await _confirmed(client)
    inv = (await client.post("/api/admin/invoices",
                             json={"quotationId": qid, "lines": LINES})).json()
    await client.post(f"/api/admin/invoices/{inv['id']}/approve")
    await client.post(f"/api/admin/invoices/{inv['id']}/payments",
                      json={"amount": 1150.0, "method": "bank", "reference": "TRX-1"})

    # Confirm the invoice really is past withdrawal, so this test is about the
    # dead end and not about some other refusal.
    refused = await client.patch(f"/api/admin/invoices/{inv['id']}/status",
                                 json={"status": "cancelled"})
    assert refused.status_code == 409
    assert "credit note" in refused.json()["detail"]

    response = await _cancel(client, qid)
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert "cannot be cancelled" in detail
    assert "credit note" in detail
    # The circular instruction must be gone.
    assert "Cancel those documents first" not in detail


@pytest.mark.anyio
async def test_both_screens_hit_one_route(client):
    """Quotations' "Remove" and Orders' "Cancel" are the same operation.

    Not a tautology worth skipping: the two screens were built separately, and
    a second cancel path that skipped this guard is exactly the defect that
    would let an invoiced order be withdrawn from one screen but not the other.
    """
    routes = set()
    for route in client._transport.app.routes:
        original = getattr(route, "original_router", None)
        for sub in getattr(original, "routes", []) if original is not None else []:
            path = getattr(sub, "path", "")
            if "quotation" in path and path.endswith("/status"):
                routes.add(path)
    assert routes == {"/api/admin/quotations/{quotation_id}/status"}


@pytest.mark.anyio
async def test_a_cancelled_order_stays_cancelled(client):
    """Cancelling twice is a no-op, not an error -- two admins, one order."""
    qid = await _confirmed(client)
    assert (await _cancel(client, qid)).status_code == 200
    assert (await _cancel(client, qid)).status_code == 200
    assert (await client.get(f"/api/admin/quotations/{qid}")).json()["status"] == "cancelled"
