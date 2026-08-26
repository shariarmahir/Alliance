"""The Recommended Workflow's arrows, not just its stages.

Inbox -> View Request -> Prepare Quotation -> Save -> Pending -> Review/Edit
-> Send E-mail -> Submitted -> Customer Confirmation -> Verify/Revise
-> Upload Work Order/PO -> Order Confirmed -> Documentation & Record

Every stage exists and every stage works. These tests ask the different
question: can the chain be short-circuited?
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


async def _fresh_inbox_request(client):
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    return quotation_id


async def test_an_order_cannot_be_confirmed_against_nothing(client, db):
    """Confirmation is the customer accepting an offer, so an offer must
    exist.

    The admin screen prices the lines and confirms in one action, so a
    confirmation arriving straight from Inbox is legitimate -- the offer is in
    the request body. What must never succeed is confirming with no priced
    lines: that would produce an Order Confirmed record with no items, no
    value, and nothing for an invoice or challan to be built from.

    Rejected by the schema (min_length=1) rather than the service, so this
    asserts 422. Recorded here anyway: the rule belongs to the workflow, and
    a later schema change that relaxed it would otherwise pass unnoticed.
    """
    quotation_id = await _fresh_inbox_request(client)

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "lines": [], "terms": TERMS},
    )
    assert r.status_code == 422


async def test_pricing_and_confirming_in_one_action_still_works(client, db):
    """The Confirm Order button saves what is on screen and confirms in the
    same call. Guarding the empty case must not break that."""
    quotation_id = await _fresh_inbox_request(client)

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "lines": LINES, "terms": TERMS},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"
    assert r.json()["confirmation"]["lines"][0]["unitPrice"] == 100.0


async def test_a_cancelled_request_cannot_be_confirmed(client, db):
    """A cancelled request is out of the workflow. Confirming it revives a
    dead record straight into Order Confirmed."""
    quotation_id = await _fresh_inbox_request(client)
    await client.patch(
        f"/api/admin/quotations/{quotation_id}/status", json={"status": "cancelled"}
    )

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "lines": LINES, "terms": TERMS},
    )
    assert r.status_code == 409


async def test_a_cancelled_request_cannot_be_re_priced(client, db):
    """Same record, the Save path rather than the Confirm path."""
    quotation_id = await _fresh_inbox_request(client)
    await client.patch(
        f"/api/admin/quotations/{quotation_id}/status", json={"status": "cancelled"}
    )

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": False, "lines": LINES, "terms": TERMS},
    )
    assert r.status_code == 409


# --- and the arrows that must keep working --------------------------------


async def test_pending_confirms_normally(client, db):
    """A customer can accept a quotation that was prepared but not emailed --
    they were phoned, or collected it in person. Pending -> Confirmed stays
    open; it is only the unquoted Inbox jump that is refused."""
    quotation_id = await _fresh_inbox_request(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": False, "lines": LINES, "terms": TERMS},
    )

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "lines": LINES, "terms": TERMS},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"


async def test_submitted_confirms_normally(client, db):
    """The main path: Submitted -> Customer Confirmation."""
    quotation_id = await _fresh_inbox_request(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": False, "lines": LINES, "terms": TERMS},
    )
    await client.patch(
        f"/api/admin/quotations/{quotation_id}/status", json={"status": "submitted"}
    )

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "lines": LINES, "terms": TERMS},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"


async def test_a_confirmed_order_can_still_be_revised(client, db):
    """Item 12: if the customer confirms with changes in price, quantity or
    terms, the quotation must be corrected against the Work Order/PO. That
    re-issue must keep working after confirmation."""
    quotation_id = await _fresh_inbox_request(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": False, "lines": LINES, "terms": TERMS},
    )
    first = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "lines": LINES, "terms": TERMS},
    )
    original_ref = first.json()["confirmation"]["refNumber"]

    revised = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True,
              "lines": [{"slug": "drive-1", "name": "Siemens Drive",
                         "quantity": 8, "unitPrice": 95.0}],
              "terms": dict(TERMS, payment="30% advance")},
    )
    assert revised.status_code == 200
    c = revised.json()["confirmation"]
    assert c["lines"][0]["quantity"] == 8
    assert c["lines"][0]["unitPrice"] == 95.0
    assert c["terms"]["payment"] == "30% advance"
    # The customer may already hold a document bearing this reference.
    assert c["refNumber"] == original_ref


async def test_the_po_can_be_filed_before_the_order_is_confirmed(client, db):
    """Item 13 sits between Customer Confirmation and Order Confirmed in the
    chain, and the customer's PO normally arrives with their acceptance. It
    must be fileable while the quotation is still Submitted, not only after
    confirming -- otherwise the workflow forces the paperwork out of order."""
    quotation_id = await _fresh_inbox_request(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": False, "lines": LINES, "terms": TERMS},
    )
    await client.patch(
        f"/api/admin/quotations/{quotation_id}/status", json={"status": "submitted"}
    )

    r = await client.patch(
        f"/api/admin/quotations/{quotation_id}/work-order",
        json={"poNumber": "PO-2026-0091"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["poNumber"] == "PO-2026-0091"
    assert r.json()["status"] == "submitted"   # filing it does not confirm

    # And it survives the confirmation that follows.
    c = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "lines": LINES, "terms": TERMS},
    )
    assert c.json()["poNumber"] == "PO-2026-0091"
    assert c.json()["status"] == "confirmed"
