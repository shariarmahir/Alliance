import pytest

from app.core.rate_limit import reset_in_memory_buckets
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.models import Category, Employee, Product
from app.schemas.session import AdminSession

async def _seed_sub_admin(db, employee_id="emp-1"):
    """require_admin re-checks that a token's employee still exists, so a
    sub-admin session needs a real row behind it or it reads as deleted."""
    db.add(
        Employee(
            id=employee_id, employee_id_number=employee_id, name="Sub", email=f"{employee_id}@x.com",
            password_hash="x", role="sub", access_options=[],
        )
    )
    await db.commit()


QUOTE_PAYLOAD = {
    "items": [
        {
            "slug": "drive-1",
            "partNumber": "PN-A",
            "name": "Siemens Drive",
            "brand": "siemens",
            "image": "/i.jpg",
            "price": 100.0,
            "quantity": 2,
        }
    ],
    "details": {
        "fullName": "Ada Lovelace",
        "email": "ada@example.com",
        "phone": "+8801700000000",
        "companyName": "Mahir Fabrics Ltd",
        "country": "Bangladesh",
        "preferredContact": "email",
        "leadTime": "standard",
        "notes": "Need urgently",
    },
}


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    reset_in_memory_buckets()
    yield
    reset_in_memory_buckets()


def _auth(client, role="super", **kwargs):
    session = AdminSession(role=role, name="Admin", email="a@x.com", **kwargs)
    client.cookies.set(ADMIN_SESSION_COOKIE, create_session_token(session))


# --- public submission ------------------------------------------------------


async def _seed_catalogue(db, price=100.0):
    """The quotation service prices from the catalogue, so the product the
    payload refers to has to exist for the total to be non-zero."""
    db.add(Category(slug="drives", name="Drives"))
    await db.flush()
    db.add(
        Product(
            slug="drive-1", part_number="PN-A", name="Siemens Drive",
            brand="siemens", category_slug="drives", price=price,
            stock="in-stock", stock_qty=10,
        )
    )
    await db.commit()


async def test_submit_quotation_computes_total_and_returns_id(client, db):
    await _seed_catalogue(db)
    r = await client.post("/api/quotations", json=QUOTE_PAYLOAD)
    assert r.status_code == 201
    body = r.json()
    assert body["total"] == 200.0
    assert body["status"] == "pending"
    assert body["id"]


async def test_submitted_total_from_client_is_ignored(client, db):
    # A client-supplied total must never be trusted.
    await _seed_catalogue(db)
    payload = {**QUOTE_PAYLOAD, "total": 1}
    r = await client.post("/api/quotations", json=payload)
    assert r.json()["total"] == 200.0


async def test_submitted_unit_price_is_replaced_by_the_catalogue(client, db):
    # The browser sends the price, so a crafted request could otherwise put a
    # 100.00 part into the admin's queue at 0.01 and misprice the offer.
    await _seed_catalogue(db)
    forged = {
        **QUOTE_PAYLOAD,
        "items": [{**QUOTE_PAYLOAD["items"][0], "price": 0.01}],
    }
    body = (await client.post("/api/quotations", json=forged)).json()
    assert body["items"][0]["price"] == 100.0
    assert body["total"] == 200.0


async def test_unknown_slug_prices_at_zero_rather_than_rejecting(client, db):
    # A delisted product must not lose the customer's enquiry; the admin
    # prices every line by hand when issuing regardless.
    await _seed_catalogue(db)
    stale = {
        **QUOTE_PAYLOAD,
        "items": [{**QUOTE_PAYLOAD["items"][0], "slug": "no-such-product"}],
    }
    r = await client.post("/api/quotations", json=stale)
    assert r.status_code == 201
    assert r.json()["total"] == 0.0


async def test_quotation_requires_valid_email(client):
    bad = {**QUOTE_PAYLOAD, "details": {**QUOTE_PAYLOAD["details"], "email": "not-an-email"}}
    assert (await client.post("/api/quotations", json=bad)).status_code == 422


async def test_quotation_requires_at_least_one_item(client):
    assert (
        await client.post("/api/quotations", json={**QUOTE_PAYLOAD, "items": []})
    ).status_code == 422


async def test_customer_can_poll_their_quotation(client):
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    r = await client.get(f"/api/quotations/{quotation_id}")
    assert r.status_code == 200 and r.json()["id"] == quotation_id
    assert (await client.get("/api/quotations/does-not-exist")).status_code == 404


async def test_contact_form_submits_and_is_rate_limited(client):
    payload = {"name": "Ada", "email": "ada@x.com", "subject": "Hi", "message": "Hello there"}
    for _ in range(5):
        assert (await client.post("/api/contact", json=payload)).status_code == 201
    # 6th within the window is throttled.
    r = await client.post("/api/contact", json=payload)
    assert r.status_code == 429 and "Retry-After" in r.headers


# --- admin RBAC -------------------------------------------------------------


async def test_quotation_list_requires_authentication(client):
    assert (await client.get("/api/admin/quotations")).status_code == 401


async def test_sub_admin_without_grant_is_forbidden(client, db):
    await _seed_sub_admin(db)
    _auth(client, role="sub", employee_id="emp-1", access_options=["orders"])
    assert (await client.get("/api/admin/quotations")).status_code == 403


async def test_sub_admin_with_grant_can_read_quotations(client, db):
    await _seed_sub_admin(db)
    _auth(client, role="sub", employee_id="emp-1", access_options=["quotations"])
    assert (await client.get("/api/admin/quotations")).status_code == 200


async def test_super_admin_can_read_quotations(client):
    _auth(client)
    assert (await client.get("/api/admin/quotations")).status_code == 200


# --- confirmation and tracking flow ----------------------------------------


async def test_confirm_then_advance_delivery_end_to_end(client):
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={
            "subject": "Financial Offer",
            "lines": [
                {
                    "name": "Siemens Drive",
                    "partNumber": "PN-A",
                    "slug": "drive-1",
                    "specifications": "24V DC",
                    "quantity": 2,
                    "unit": "Pcs",
                    "unitPrice": 150.0,
                }
            ],
        },
    )
    assert r.status_code == 200
    confirmation = r.json()["confirmation"]
    assert r.json()["status"] == "confirmed"
    assert confirmation["grandTotal"] == 300.0

    # Advance delivery, then read it back from the admin's own view of the
    # quotation — there is no public tracking endpoint any more.
    patch = await client.patch(
        f"/api/admin/quotations/{quotation_id}/delivery", json={"stage": 2}
    )
    assert patch.status_code == 200
    assert patch.json()["confirmation"]["deliveryStage"] == 2


async def test_cancelling_retracts_the_confirmation(client):
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"lines": [{"name": "D", "quantity": 1, "unitPrice": 5.0}]},
    )

    r = await client.patch(
        f"/api/admin/quotations/{quotation_id}/status", json={"status": "cancelled"}
    )
    assert r.json()["confirmation"] is None


async def test_viewed_is_no_longer_a_valid_status(client, db):
    """"viewed" was removed as a triage state; the status endpoint must
    reject it rather than silently accept an unrecognised value."""
    _auth(client)
    await _seed_catalogue(db)
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]

    r = await client.patch(
        f"/api/admin/quotations/{quotation_id}/status", json={"status": "viewed"}
    )
    assert r.status_code == 422


async def _issued_quotation(client, db):
    """A confirmed quotation, ready to email."""
    await _seed_catalogue(db)
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"lines": [{"name": "D", "quantity": 1, "unitPrice": 5.0}]},
    )
    return quotation_id


async def test_email_uses_the_pdf_the_browser_supplies(client, db):
    """The admin's browser renders the document that the download button
    produces and posts it here, so the customer receives exactly that file
    rather than the server's plainer fallback rendering."""
    import base64
    from unittest.mock import AsyncMock, patch

    _auth(client)
    quotation_id = await _issued_quotation(client, db)
    supplied = b"%PDF-1.4 browser rendered"

    with patch(
        "app.routers.admin_operations.email_integration.send_quotation_issued",
        new=AsyncMock(return_value=True),
    ) as send:
        r = await client.post(
            f"/api/admin/quotations/{quotation_id}/email",
            json={"pdfBase64": base64.b64encode(supplied).decode()},
        )

    assert r.status_code == 200
    assert r.json() == {"sent": True, "attached": True}
    # The bytes that reached the mailer are the ones posted, untouched.
    assert send.await_args.args[1] == supplied


async def test_email_rejects_a_non_pdf_attachment(client, db):
    """base64 of arbitrary bytes must not become an email attachment."""
    import base64

    _auth(client)
    quotation_id = await _issued_quotation(client, db)

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/email",
        json={"pdfBase64": base64.b64encode(b"<html>not a pdf").decode()},
    )
    assert r.status_code == 422


async def test_email_rejects_malformed_base64(client, db):
    _auth(client)
    quotation_id = await _issued_quotation(client, db)

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/email",
        json={"pdfBase64": "not-base64!!"},
    )
    assert r.status_code == 422


async def test_email_falls_back_to_server_rendering(client, db):
    """A caller that sends no PDF still gets an attachment, so the endpoint
    keeps working for anything that is not the admin dialog."""
    from unittest.mock import AsyncMock, patch

    _auth(client)
    quotation_id = await _issued_quotation(client, db)

    with patch(
        "app.routers.admin_operations.email_integration.send_quotation_issued",
        new=AsyncMock(return_value=True),
    ), patch(
        "app.routers.admin_operations.pdf_integration.render_quotation_pdf",
        return_value=b"%PDF-server",
    ):
        r = await client.post(f"/api/admin/quotations/{quotation_id}/email", json={})

    assert r.status_code == 200
    assert r.json()["attached"] is True


async def test_clear_cancelled_removes_only_cancelled(client, db):
    """The route deletes by status from the database, not from a list of ids
    the client supplies, so a pending request can never be swept up."""
    _auth(client)
    await _seed_catalogue(db)

    keep = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    drop = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    await client.patch(
        f"/api/admin/quotations/{drop}/status", json={"status": "cancelled"}
    )

    r = await client.delete("/api/admin/quotations/cancelled")
    assert r.status_code == 200
    assert r.json() == {"removed": 1}

    remaining = (await client.get("/api/admin/quotations")).json()
    ids = [q["id"] for q in remaining]
    assert keep in ids
    assert drop not in ids


async def test_clear_cancelled_is_super_admin_only(client, db):
    """A sub-admin with the quotations grant can cancel a single quotation,
    but must not be able to destroy every cancelled record at once."""
    await _seed_sub_admin(db)
    _auth(client, role="sub", employee_id="emp-1", access_options=["quotations"])

    assert (await client.delete("/api/admin/quotations/cancelled")).status_code == 403


async def test_clear_cancelled_with_nothing_to_remove(client, db):
    _auth(client)
    r = await client.delete("/api/admin/quotations/cancelled")
    assert r.status_code == 200 and r.json() == {"removed": 0}


# --- orders -----------------------------------------------------------------


async def test_create_order_and_admin_status_update(client):
    r = await client.post(
        "/api/orders",
        json={
            "items": QUOTE_PAYLOAD["items"],
            "subtotal": 200.0,
            "shippingCost": 20.0,
            "grandTotal": 220.0,
            "deliveryOption": "express",
            "deliveryOptionName": "Express",
            "deliveryEta": "2-3 days",
            "preferredDate": "2026-09-01",
            "address": {
                "name": "Ada Lovelace",
                "line": "House 104",
                "city": "Dhaka",
                "country": "Bangladesh",
                "phone": "+8801700000000",
            },
        },
    )
    assert r.status_code == 201
    order_number = r.json()["orderNumber"]
    assert order_number.startswith("AIT-ORD-")

    _auth(client)
    patch = await client.patch(
        f"/api/admin/orders/{order_number}/status", json={"status": "confirmed"}
    )
    assert patch.status_code == 200 and patch.json()["status"] == "confirmed"


async def test_contact_request_handled_toggle(client):
    await client.post(
        "/api/contact",
        json={"name": "Ada", "email": "ada@x.com", "subject": "S", "message": "M"},
    )
    _auth(client)
    listed = (await client.get("/api/admin/contact-requests")).json()
    assert len(listed) == 1 and listed[0]["handled"] is False

    r = await client.patch(
        f"/api/admin/contact-requests/{listed[0]['id']}/handled", json={"handled": True}
    )
    assert r.status_code == 200 and r.json()["handled"] is True
