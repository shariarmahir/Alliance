"""Invoices and challans as grants of their own.

Both used to ride the "orders" grant, so delegating delivery updates also
handed over invoice approval. Splitting them lets the two jobs be given to
different people.

The risk in a split like this is silent revocation: nobody's stored
access_options change on deploy, but what those options open does. So
"orders" keeps implying both, and that is the first thing tested here.
"""

import pytest

from app.core.rate_limit import reset_in_memory_buckets
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.models import Employee
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


async def _sub(client, db, *areas, employee_id="emp-1"):
    """A sub-admin with exactly these grants, backed by a real row --
    require_admin re-checks the employee exists, so a token without one reads
    as deleted and returns 401 instead of the 403 these tests are about."""
    if await db.get(Employee, employee_id) is None:
        db.add(Employee(id=employee_id, employee_id_number=employee_id, name="Sub",
                        email=f"{employee_id}@x.com", password_hash="x", role="sub",
                        access_options=[]))
        await db.commit()
    _auth(client, role="sub", employee_id=employee_id, access_options=list(areas))


async def _confirmed(client):
    qid = (await client.post("/api/quotations", json=QUOTE)).json()["id"]
    _auth(client)
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": False, "lines": LINES, "terms": TERMS})
    await client.post(f"/api/admin/quotations/{qid}/confirm",
                      json={"confirm": True, "lines": LINES, "terms": TERMS})
    return qid


@pytest.mark.anyio
async def test_orders_grant_still_opens_invoices_and_challans(client, db):
    """The compatibility case. Accounts that predate the split keep working.

    If this fails, deploying the split quietly locks existing staff out of
    screens they used yesterday, with nothing in their account changed to
    explain it.
    """
    await _sub(client, db, "orders")
    assert (await client.get("/api/admin/invoices")).status_code == 200
    assert (await client.get("/api/admin/challans")).status_code == 200


@pytest.mark.anyio
async def test_invoices_grant_does_not_open_challans(client, db):
    """The point of splitting: billing without dispatch."""
    await _sub(client, db, "invoices")
    assert (await client.get("/api/admin/invoices")).status_code == 200
    assert (await client.get("/api/admin/challans")).status_code == 403
    # And not the orders screen it was carved out of.
    assert (await client.get("/api/admin/orders")).status_code == 403


@pytest.mark.anyio
async def test_challans_grant_does_not_open_invoices(client, db):
    """And the mirror: dispatch without billing."""
    await _sub(client, db, "challans")
    assert (await client.get("/api/admin/challans")).status_code == 200
    assert (await client.get("/api/admin/invoices")).status_code == 403


@pytest.mark.anyio
async def test_neither_grant_opens_either(client, db):
    """A grant unrelated to fulfilment opens nothing here."""
    await _sub(client, db, "emails")
    assert (await client.get("/api/admin/invoices")).status_code == 403
    assert (await client.get("/api/admin/challans")).status_code == 403


@pytest.mark.anyio
async def test_invoice_writes_are_gated_too_not_just_the_listing(client, db):
    """Read gating alone would leave every write endpoint wide open.

    Worth stating separately: the listing is one route out of nine, and it is
    the writes that actually move money.
    """
    qid = await _confirmed(client)
    await _sub(client, db, "challans")

    created = await client.post("/api/admin/invoices",
                                json={"quotationId": qid, "lines": LINES})
    assert created.status_code == 403

    # Prove the same call succeeds with the right grant, so this is measuring
    # the gate rather than a malformed request.
    await _sub(client, db, "invoices", employee_id="emp-2")
    assert (await client.post("/api/admin/invoices",
                              json={"quotationId": qid, "lines": LINES})).status_code == 201


@pytest.mark.anyio
async def test_challan_dispatch_is_gated(client, db):
    qid = await _confirmed(client)
    challan = (await client.post("/api/admin/challans",
                                 json={"quotationId": qid, "lines": LINES})).json()

    await _sub(client, db, "invoices")
    dispatch = await client.post(
        f"/api/admin/challans/{challan['id']}/dispatch",
        json={"vehicleNumber": "DH-1", "driverName": "K", "driverPhone": "+8801700000000",
              "dispatchedBy": "A", "remarks": ""},
    )
    assert dispatch.status_code == 403


@pytest.mark.anyio
async def test_balances_readable_by_whoever_is_preparing(client, db):
    """Per-line balances are the guard rail against over-billing and
    over-shipping, so they must be readable by everyone who can do either.
    Gating them behind "orders" alone hid them from exactly those people."""
    qid = await _confirmed(client)

    for area in ("orders", "invoices", "challans"):
        await _sub(client, db, area, employee_id=f"emp-{area}")
        response = await client.get(f"/api/admin/quotations/{qid}/balances")
        assert response.status_code == 200, area

    await _sub(client, db, "emails", employee_id="emp-none")
    assert (await client.get(f"/api/admin/quotations/{qid}/balances")).status_code == 403


@pytest.mark.anyio
async def test_history_readable_from_the_quotations_screen(client, db):
    """The History button lives on Quotations, so that grant must open it --
    otherwise the same grant renders a button that 403s when clicked."""
    qid = await _confirmed(client)
    await _sub(client, db, "quotations")
    assert (await client.get(f"/api/admin/quotations/{qid}/history")).status_code == 200


@pytest.mark.anyio
async def test_super_admin_reaches_everything_regardless(client):
    qid = await _confirmed(client)
    for path in ("/api/admin/invoices", "/api/admin/challans",
                 f"/api/admin/quotations/{qid}/balances"):
        assert (await client.get(path)).status_code == 200, path
