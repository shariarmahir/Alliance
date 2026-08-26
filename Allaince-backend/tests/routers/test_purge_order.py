"""Remove anyway: destroying one order and everything raised against it.

The ordinary cancel refuses while invoices or challans stand against an
order, and refuses permanently once those are paid or delivered. That is
right for the normal case and wrong when an admin genuinely needs a bad
order gone -- a test order, a duplicate, a customer that never existed.

This is the escape hatch. It destroys the quotation, its confirmation, its
invoices, its challans, their lines and every recorded receipt. What it does
not destroy is the arithmetic: a stub survives with the amounts, so revenue
that vanished can still be accounted for.
"""

import pytest

from app.core.rate_limit import reset_in_memory_buckets
from app.models import Employee
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


async def _paid_order(client):
    """The state the screenshot is in: invoiced, delivered and paid."""
    qid = await _confirmed(client)
    inv = (await client.post("/api/admin/invoices",
                             json={"quotationId": qid, "lines": LINES})).json()
    await client.post(f"/api/admin/invoices/{inv['id']}/approve")
    await client.post(f"/api/admin/invoices/{inv['id']}/payments",
                      json={"amount": 1000.0, "method": "bank", "reference": "TRX-1"})
    challan = (await client.post("/api/admin/challans",
                                 json={"quotationId": qid, "lines": LINES})).json()
    return qid, inv["id"], challan["id"]


async def _purge(client, qid, reason="duplicate order"):
    return await client.request(
        "DELETE", f"/api/admin/quotations/{qid}", json={"reason": reason}
    )


@pytest.mark.anyio
async def test_purge_removes_the_order_from_every_screen(client):
    """The whole point: gone from quotations, invoices and challans alike."""
    qid, inv_id, challan_id = await _paid_order(client)

    # It really is unremovable the ordinary way first, or this test is
    # measuring nothing.
    assert (await client.patch(f"/api/admin/quotations/{qid}/status",
                               json={"status": "cancelled"})).status_code == 409

    assert (await _purge(client, qid)).status_code == 200

    assert (await client.get(f"/api/admin/quotations/{qid}")).status_code == 404
    assert (await client.get(f"/api/admin/invoices/{inv_id}")).status_code == 404
    assert (await client.get(f"/api/admin/challans/{challan_id}")).status_code == 404

    # And out of every listing, not just unreachable by id.
    assert all(q["id"] != qid for q in (await client.get("/api/admin/quotations")).json())
    assert all(i["id"] != inv_id for i in (await client.get("/api/admin/invoices")).json())
    assert all(c["id"] != challan_id for c in (await client.get("/api/admin/challans")).json())


@pytest.mark.anyio
async def test_purge_keeps_the_money_on_the_record(client):
    """Receipts are facts. The documents go; the arithmetic survives."""
    qid, _, _ = await _paid_order(client)
    stub = (await _purge(client, qid, reason="customer never existed")).json()

    assert stub["refNumber"]
    assert stub["companyName"] == "Mahir Fabrics Ltd"
    assert stub["amountInvoiced"] == pytest.approx(1000.0)
    assert stub["amountReceived"] == pytest.approx(1000.0)
    assert stub["invoiceCount"] == 1
    assert stub["challanCount"] == 1
    assert stub["deletedBy"] == "a@x.com"
    assert stub["reason"] == "customer never existed"
    # Charted against when it was booked, not when it was deleted.
    assert stub["confirmedAt"] is not None

    listed = (await client.get("/api/admin/deleted-orders")).json()
    assert [s["id"] for s in listed] == [stub["id"]]


@pytest.mark.anyio
async def test_purged_order_leaves_live_revenue_and_lands_in_deleted_revenue(client):
    """Deleted revenue is its own series, not a negative in the real one.

    Netting a deletion against sales would understate income for the period
    and make the two figures impossible to reconcile separately.
    """
    qid, _, _ = await _paid_order(client)
    before = (await client.get("/api/admin/analytics?range=month")).json()
    assert before["revenue"] > 0
    assert before["deletedRevenue"] == 0

    await _purge(client, qid)
    after = (await client.get("/api/admin/analytics?range=month")).json()

    # It left live revenue entirely...
    assert after["revenue"] == pytest.approx(before["revenue"] - 1000.0)
    assert after["orderCount"] == before["orderCount"] - 1
    # ...and turned up in its own series instead.
    assert after["deletedRevenue"] == pytest.approx(1000.0)
    assert after["deletedOrderCount"] == 1
    assert sum(p["value"] for p in after["deletedRevenueTrend"]) == pytest.approx(1000.0)


@pytest.mark.anyio
async def test_purge_takes_only_the_order_named(client):
    """One order. A purge that reached a neighbour would be unrecoverable."""
    keep = await _confirmed(client)
    drop, _, _ = await _paid_order(client)

    await _purge(client, drop)

    assert (await client.get(f"/api/admin/quotations/{keep}")).status_code == 200
    assert (await client.get(f"/api/admin/quotations/{drop}")).status_code == 404
    assert len((await client.get("/api/admin/deleted-orders")).json()) == 1


@pytest.mark.anyio
async def test_sub_admin_cannot_purge_even_with_quotations_granted(client, db):
    """Destroying financial records is not a delegable permission."""
    qid, _, _ = await _paid_order(client)
    # require_admin re-checks the employee exists, so the token needs a row
    # behind it -- otherwise this would pass on a 401 and prove nothing
    # about the super-admin gate.
    db.add(Employee(id="e1", employee_id_number="e1", name="Sub", email="e1@x.com",
                    password_hash="x", role="sub", access_options=[]))
    await db.commit()
    _auth(client, role="sub", employee_id="e1",
          access_options=["quotations", "orders"])

    assert (await _purge(client, qid)).status_code == 403
    assert (await client.get("/api/admin/deleted-orders")).status_code == 403

    # And the order is untouched, not partially destroyed.
    _auth(client)
    assert (await client.get(f"/api/admin/quotations/{qid}")).status_code == 200
    assert (await client.get("/api/admin/deleted-orders")).json() == []


@pytest.mark.anyio
async def test_purge_requires_a_session(client):
    qid = await _confirmed(client)
    client.cookies.clear()
    assert (await _purge(client, qid)).status_code == 401


@pytest.mark.anyio
async def test_purging_an_unknown_order_is_404_not_a_silent_success(client):
    _auth(client)
    assert (await _purge(client, "does-not-exist")).status_code == 404
    assert (await client.get("/api/admin/deleted-orders")).json() == []


@pytest.mark.anyio
async def test_purge_works_on_an_order_with_no_documents(client):
    """The plain case: nothing was ever raised, so the stub reads zero."""
    qid = await _confirmed(client)
    stub = (await _purge(client, qid, reason="")).json()

    assert stub["amountInvoiced"] == 0
    assert stub["amountReceived"] == 0
    assert stub["invoiceCount"] == 0
    assert stub["challanCount"] == 0
    assert stub["grandTotal"] > 0
    assert (await client.get(f"/api/admin/quotations/{qid}")).status_code == 404


@pytest.mark.anyio
async def test_stub_is_not_editable_or_deletable(client):
    """An audit trail an admin can rewrite is not an audit trail."""
    qid, _, _ = await _paid_order(client)
    stub = (await _purge(client, qid)).json()

    for method in ("PATCH", "PUT", "DELETE"):
        response = await client.request(
            method, f"/api/admin/deleted-orders/{stub['id']}", json={"amountReceived": 0}
        )
        assert response.status_code in (404, 405), method

    assert (await client.get("/api/admin/deleted-orders")).json()[0][
        "amountReceived"
    ] == pytest.approx(1000.0)
