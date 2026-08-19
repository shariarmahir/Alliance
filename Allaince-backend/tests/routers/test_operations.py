import pytest

from app.core.rate_limit import reset_in_memory_buckets
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.schemas.session import AdminSession

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


async def test_submit_quotation_computes_total_and_returns_id(client):
    r = await client.post("/api/quotations", json=QUOTE_PAYLOAD)
    assert r.status_code == 201
    body = r.json()
    assert body["total"] == 200.0
    assert body["status"] == "pending"
    assert body["id"]


async def test_submitted_total_from_client_is_ignored(client):
    # A client-supplied total must never be trusted.
    payload = {**QUOTE_PAYLOAD, "total": 1}
    r = await client.post("/api/quotations", json=payload)
    assert r.json()["total"] == 200.0


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


async def test_sub_admin_without_grant_is_forbidden(client):
    _auth(client, role="sub", employee_id="emp-1", access_options=["orders"])
    assert (await client.get("/api/admin/quotations")).status_code == 403


async def test_sub_admin_with_grant_can_read_quotations(client):
    _auth(client, role="sub", employee_id="emp-1", access_options=["quotations"])
    assert (await client.get("/api/admin/quotations")).status_code == 200


async def test_super_admin_can_read_quotations(client):
    _auth(client)
    assert (await client.get("/api/admin/quotations")).status_code == 200


# --- confirmation and tracking flow ----------------------------------------


async def test_confirm_then_track_end_to_end(client):
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
    tracking_id = confirmation["trackingId"]

    # Advance delivery, then read it back from the public tracking endpoint.
    patch = await client.patch(
        f"/api/admin/quotations/{quotation_id}/delivery", json={"stage": 2}
    )
    assert patch.status_code == 200

    client.cookies.clear()
    track = await client.get(f"/api/track/{tracking_id}")
    assert track.status_code == 200
    body = track.json()
    assert body["stage"] == 2 and body["stageLabel"] == "In Transit"
    assert len(body["stages"]) == 4


async def test_tracking_response_excludes_pricing_and_contact_details(client):
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    confirmation = (
        await client.post(
            f"/api/admin/quotations/{quotation_id}/confirm",
            json={"lines": [{"name": "D", "quantity": 1, "unitPrice": 500.0}]},
        )
    ).json()["confirmation"]
    client.cookies.clear()

    text = (await client.get(f"/api/track/{confirmation['trackingId']}")).text
    # A tracking ID may be forwarded to anyone, so it must not leak these.
    assert "ada@example.com" not in text
    assert "500" not in text
    assert "Mahir Fabrics" not in text


async def test_unknown_tracking_id_is_404(client):
    assert (await client.get("/api/track/AIT-TRK-NOTREAL")).status_code == 404


async def test_cancelling_retracts_the_confirmation_over_http(client):
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    confirmation = (
        await client.post(
            f"/api/admin/quotations/{quotation_id}/confirm",
            json={"lines": [{"name": "D", "quantity": 1, "unitPrice": 5.0}]},
        )
    ).json()["confirmation"]
    tracking_id = confirmation["trackingId"]

    r = await client.patch(
        f"/api/admin/quotations/{quotation_id}/status", json={"status": "cancelled"}
    )
    assert r.json()["confirmation"] is None

    # The retracted document must no longer be reachable by tracking ID.
    client.cookies.clear()
    assert (await client.get(f"/api/track/{tracking_id}")).status_code == 404


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
