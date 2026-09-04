"""The sidebar badge counts, and the batch that replaced the per-row derive.

The admin layout renders on every navigation. It used to get its five badge
numbers by listing every product, quotation and contact request in full and
taking len() of each -- and listing quotations derived each order's delivery
and payment position with three more queries per row. Every screen change
paid for all of it before anything rendered.

Two things are covered here: that the counting endpoint reports the same
numbers the old listings would have, respecting the caller's grants; and that
the batch derive returns exactly what the per-row functions returned.
"""

import pytest

from app.core.rate_limit import reset_in_memory_buckets
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.models import Employee
from app.schemas.session import AdminSession
from app.services import operations as svc


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


async def _sub(client, db, *areas, employee_id="emp-1"):
    """A sub-admin with exactly these grants, backed by a real row --
    require_admin re-checks the employee exists, so a token without one reads
    as deleted and returns 401."""
    if await db.get(Employee, employee_id) is None:
        db.add(Employee(id=employee_id, employee_id_number=employee_id, name="Sub",
                        email=f"{employee_id}@x.com", password_hash="x", role="sub",
                        access_options=[]))
        await db.commit()
    _auth(client, role="sub", employee_id=employee_id, access_options=list(areas))


async def _counts(client):
    response = await client.get("/api/admin/analytics/nav-counts")
    assert response.status_code == 200
    return response.json()


@pytest.mark.anyio
async def test_counts_start_at_zero(client):
    _auth(client)
    counts = await _counts(client)
    assert counts == {
        "products": 0,
        "lowStock": 0,
        "pendingOrders": 0,
        "pendingQuotations": 0,
        "openContactRequests": 0,
    }


@pytest.mark.anyio
async def test_an_open_request_counts_as_a_pending_quotation(client):
    """Every stage short of a decision is still work in hand."""
    await client.post("/api/quotations", json=QUOTE)
    _auth(client)

    counts = await _counts(client)
    assert counts["pendingQuotations"] == 1
    assert counts["pendingOrders"] == 0


@pytest.mark.anyio
async def test_a_confirmed_order_stops_counting_as_a_pending_quotation(client):
    """Confirming moves the row out of the quotations badge.

    It does not land in pendingOrders either: confirming takes the order
    straight to the final delivery stage, which is what "not pending" means.
    """
    qid = (await client.post("/api/quotations", json=QUOTE)).json()["id"]
    _auth(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": False, "lines": LINES, "terms": TERMS})
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})

    counts = await _counts(client)
    assert counts["pendingQuotations"] == 0


@pytest.mark.anyio
async def test_an_unhandled_contact_request_counts_until_it_is_handled(client):
    await client.post("/api/contact", json={
        "name": "Bob", "email": "bob@example.com", "phone": "+8801700000000",
        "subject": "Quote please", "message": "Hello there, I need a quote.",
    })
    _auth(client)
    assert (await _counts(client))["openContactRequests"] == 1

    requests = (await client.get("/api/admin/contact-requests")).json()
    handled = await client.patch(
        f"/api/admin/contact-requests/{requests[0]['id']}/handled", json={"handled": True}
    )
    assert handled.status_code == 200
    assert (await _counts(client))["openContactRequests"] == 0


@pytest.mark.anyio
async def test_a_sub_admin_without_the_grant_sees_zero_not_the_real_number(client, db):
    """The badge must never report a total from a screen they cannot open."""
    await client.post("/api/quotations", json=QUOTE)
    await client.post("/api/contact", json={
        "name": "Bob", "email": "bob@example.com", "phone": "+8801700000000",
        "subject": "Quote please", "message": "Hello there, I need a quote.",
    })

    _auth(client, role="super")
    assert (await _counts(client))["pendingQuotations"] == 1

    # Same data, a sub-admin whose only grant is an unrelated area.
    await _sub(client, db, "emails")
    counts = await _counts(client)
    assert counts["pendingQuotations"] == 0
    assert counts["pendingOrders"] == 0
    assert counts["openContactRequests"] == 0


@pytest.mark.anyio
async def test_a_sub_admin_with_the_grant_sees_the_real_number(client, db):
    await client.post("/api/quotations", json=QUOTE)
    await _sub(client, db, "quotations")
    assert (await _counts(client))["pendingQuotations"] == 1


# --- the batch derive -------------------------------------------------------


@pytest.mark.anyio
async def test_batch_derive_matches_the_per_row_functions(client, db):
    """`derived_positions` is only worth having if it answers identically.

    Three orders in different states -- unpaid, part-paid, paid in full --
    so the comparison covers the branches that differ.
    """
    _auth(client)
    for paid in (0.0, 400.0, 1000.0):
        qid = (await client.post("/api/quotations", json=QUOTE)).json()["id"]
        _auth(client)
        await client.post(f"/api/admin/quotations/{qid}/confirm",
                          json={"confirm": False, "lines": LINES, "terms": TERMS})
        await client.post(f"/api/admin/quotations/{qid}/confirm",
                          json={"confirm": True, "lines": LINES, "terms": TERMS})
        inv = (await client.post("/api/admin/invoices",
                                 json={"quotationId": qid, "lines": LINES})).json()
        await client.post(f"/api/admin/invoices/{inv['id']}/approve")
        if paid:
            await client.post(f"/api/admin/invoices/{inv['id']}/payments",
                              json={"amount": paid, "method": "bank", "reference": "T"})

    rows = await svc.list_quotations(db)
    batch = await svc.derived_positions(db, rows)

    assert len(batch) == 3
    for quotation in rows:
        expected = {
            "delivery_complete": await svc.delivered_in_full(db, quotation),
            **await svc.payment_position(db, quotation),
        }
        assert batch[quotation.id] == expected


@pytest.mark.anyio
async def test_a_settled_order_carries_the_date_the_money_arrived(client):
    """The Orders history showed a green tick against "Not yet".

    payment_status is derived from the invoices, but payment_received_at was
    a stored column only an unused endpoint ever wrote -- so an order paid
    through its invoices read "received" with no date behind it.
    """
    qid = (await client.post("/api/quotations", json=QUOTE)).json()["id"]
    _auth(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": False, "lines": LINES, "terms": TERMS})
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})
    inv = (await client.post("/api/admin/invoices",
                             json={"quotationId": qid, "lines": LINES})).json()
    await client.post(f"/api/admin/invoices/{inv['id']}/approve")
    await client.post(f"/api/admin/invoices/{inv['id']}/payments",
                      json={"amount": 1000.0, "method": "bank", "reference": "TRX-1"})

    confirmation = (await client.get(f"/api/admin/quotations/{qid}")).json()["confirmation"]
    assert confirmation["paymentStatus"] == "received"
    assert confirmation["paymentReceivedAt"] is not None


@pytest.mark.anyio
async def test_an_unpaid_order_has_no_payment_date(client):
    qid = (await client.post("/api/quotations", json=QUOTE)).json()["id"]
    _auth(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": False, "lines": LINES, "terms": TERMS})
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})

    confirmation = (await client.get(f"/api/admin/quotations/{qid}")).json()["confirmation"]
    assert confirmation["paymentStatus"] == "pending"
    assert confirmation["paymentReceivedAt"] is None
