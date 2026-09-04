import pytest

from app.core.rate_limit import reset_in_memory_buckets
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.models import Category, Employee, Product
from app.schemas.session import AdminSession
from app.services import operations as svc

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
    # A new customer request lands untouched in the inbox.
    assert body["status"] == "inbox"
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


async def test_emailing_the_quotation_marks_it_submitted(client, db):
    """"Submitted" has to mean the customer actually received it, so the
    status advances on a successful send rather than on the click."""
    import base64
    from unittest.mock import AsyncMock, patch

    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": False, "lines": [{"name": "D", "quantity": 1, "unitPrice": 10.0}]},
    )
    assert (await client.get(f"/api/admin/quotations/{quotation_id}")).json()["status"] == "pending"

    with patch(
        "app.routers.admin_operations.email_integration.send_quotation_issued",
        new=AsyncMock(return_value=True),
    ):
        r = await client.post(
            f"/api/admin/quotations/{quotation_id}/email",
            json={"pdfBase64": base64.b64encode(b"%PDF-1.4 x").decode()},
        )
    assert r.status_code == 200

    body = (await client.get(f"/api/admin/quotations/{quotation_id}")).json()
    assert body["status"] == "submitted"
    assert body["quotedSentAt"] is not None


async def test_a_failed_send_leaves_the_status_alone(client, db):
    """A mail failure must not claim the customer was sent anything."""
    import base64
    from unittest.mock import AsyncMock, patch

    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": False, "lines": [{"name": "D", "quantity": 1, "unitPrice": 10.0}]},
    )

    with patch(
        "app.routers.admin_operations.email_integration.send_quotation_issued",
        new=AsyncMock(return_value=False),
    ):
        r = await client.post(
            f"/api/admin/quotations/{quotation_id}/email",
            json={"pdfBase64": base64.b64encode(b"%PDF-1.4 x").decode()},
        )
    assert r.status_code == 502

    body = (await client.get(f"/api/admin/quotations/{quotation_id}")).json()
    assert body["status"] == "pending"
    assert body["quotedSentAt"] is None


async def test_resending_does_not_walk_a_confirmed_quotation_backwards(client, db):
    """Re-sending a copy of the document is not the customer un-deciding."""
    import base64
    from unittest.mock import AsyncMock, patch

    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True, "lines": [{"name": "D", "quantity": 1, "unitPrice": 10.0}]},
    )

    with patch(
        "app.routers.admin_operations.email_integration.send_quotation_issued",
        new=AsyncMock(return_value=True),
    ):
        await client.post(
            f"/api/admin/quotations/{quotation_id}/email",
            json={"pdfBase64": base64.b64encode(b"%PDF-1.4 x").decode()},
        )

    assert (
        await client.get(f"/api/admin/quotations/{quotation_id}")
    ).json()["status"] == "confirmed"


async def test_work_order_upload_attaches_the_document(client, db, tmp_path, monkeypatch):
    import io

    monkeypatch.chdir(tmp_path)
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/work-order",
        files={"file": ("po.pdf", io.BytesIO(b"%PDF-1.4 purchase order"), "application/pdf")},
        data={"poNumber": "PO-8891"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["poDocumentUrl"].endswith(".pdf")
    assert body["poUploadedAt"] is not None


async def test_work_order_rejects_an_executable(client, db, tmp_path, monkeypatch):
    """A PO is paperwork; the document allow-list must not accept a binary."""
    import io

    monkeypatch.chdir(tmp_path)
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/work-order",
        files={"file": ("payload.exe", io.BytesIO(b"MZ..."), "application/octet-stream")},
    )
    assert r.status_code == 400


async def test_work_order_number_can_be_set_without_a_file(client, db):
    """The PO number often arrives in an email before the signed PDF does."""
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)

    r = await client.patch(
        f"/api/admin/quotations/{quotation_id}/work-order", json={"poNumber": "PO-1234"}
    )
    assert r.status_code == 200
    assert r.json()["poNumber"] == "PO-1234"
    assert r.json()["poDocumentUrl"] is None


async def test_pricing_without_confirm_marks_pending_not_confirmed(client):
    """Producing the quotation document is not the same as accepting it.

    An admin prices a request so they can download or email the PDF. That
    moves it out of the inbox to "pending" — prepared but not yet sent — and
    it must not become "confirmed" until they explicitly say so.
    """
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={
            "confirm": False,
            "lines": [{"name": "D", "quantity": 2, "unitPrice": 150.0}],
        },
    )
    assert r.status_code == 200
    # The priced offer is saved...
    assert r.json()["confirmation"]["grandTotal"] == 300.0
    # ...but the request has not been accepted.
    assert r.json()["status"] == "pending"

    # Confirming afterwards keeps the same reference rather than minting a new
    # one, so the customer's copy stays valid.
    ref = r.json()["confirmation"]["refNumber"]
    confirmed = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"lines": [{"name": "D", "quantity": 2, "unitPrice": 150.0}]},
    )
    assert confirmed.json()["status"] == "confirmed"
    assert confirmed.json()["confirmation"]["refNumber"] == ref

    # Re-downloading the PDF afterwards must not walk an accepted order back
    # into the open queue.
    again = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": False, "lines": [{"name": "D", "quantity": 2, "unitPrice": 150.0}]},
    )
    assert again.json()["status"] == "confirmed"


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

    # Advance the order, then read it back from the admin's own view of the
    # quotation — there is no public tracking endpoint any more.
    patch = await client.patch(
        f"/api/admin/quotations/{quotation_id}/delivery",
        json={"stage": svc.MAX_STAGE},
    )
    assert patch.status_code == 200
    assert patch.json()["confirmation"]["deliveryStage"] == svc.MAX_STAGE


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


async def _paid_through_an_invoice(client, quotation_id, amount=5.0):
    """Money in, the way it actually arrives.

    A receipt asserts that payment was received, and that is now derived from
    the invoices raised against the order rather than a flag on it. Setting
    the old payment_status endpoint no longer makes an order look paid, which
    is the point -- it is what let the dashboard read zero collected while
    every row claimed RECEIVED.
    """
    # An invoice can only be raised against a confirmed order, and
    # _issued_quotation stops at the priced offer.
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={"confirm": True,
              "lines": [{"slug": "drive-1", "name": "D", "quantity": 1,
                         "unitPrice": amount}]},
    )
    raised = await client.post("/api/admin/invoices",
                               json={"quotationId": quotation_id,
                                     "lines": [{"slug": "drive-1", "name": "D",
                                                "quantity": 1,
                                                "unitPrice": amount}]})
    # Surfaced rather than a bare KeyError on the next line: the invoice
    # guards reject by message, and a silent 400 here reads as the receipt
    # test failing for its own reasons.
    assert raised.status_code == 201, raised.text
    inv = raised.json()
    await client.post(f"/api/admin/invoices/{inv['id']}/approve")
    await client.post(f"/api/admin/invoices/{inv['id']}/payments",
                      json={"amount": amount, "method": "bank", "reference": "TRX"})
    return inv


async def test_confirming_an_order_emails_the_customer_once(client, db):
    """Moving an order to the confirmed stage tells the customer.

    Re-selecting the stage it already holds must not send a second copy —
    a customer receiving duplicate confirmations for one order is worse
    than receiving none.
    """
    from unittest.mock import AsyncMock, patch

    _auth(client)
    quotation_id = await _issued_quotation(client, db)

    with patch(
        "app.routers.admin_operations.email_integration.send_order_confirmed",
        new=AsyncMock(return_value=True),
    ) as send:
        first = await client.patch(
            f"/api/admin/quotations/{quotation_id}/delivery",
            json={"stage": svc.MAX_STAGE},
        )
        assert first.status_code == 200
        assert send.await_count == 1

        # Same stage again: already confirmed, so nothing more is sent.
        await client.patch(
            f"/api/admin/quotations/{quotation_id}/delivery",
            json={"stage": svc.MAX_STAGE},
        )
        assert send.await_count == 1


async def test_moving_an_order_back_to_pending_sends_no_email(client, db):
    """Only the transition into confirmed notifies the customer."""
    from unittest.mock import AsyncMock, patch

    _auth(client)
    quotation_id = await _issued_quotation(client, db)

    with patch(
        "app.routers.admin_operations.email_integration.send_order_confirmed",
        new=AsyncMock(return_value=True),
    ) as send:
        await client.patch(
            f"/api/admin/quotations/{quotation_id}/delivery", json={"stage": 0}
        )
        assert send.await_count == 0


async def test_setting_payment_by_hand_is_refused(client, db):
    """The endpoint that used to set payment status now refuses.

    Payment is derived from the order's invoices. Leaving this route
    accepting writes would let a caller believe it had recorded money that
    no screen would ever show -- the drift that had the Overview reporting
    zero collected while every row read RECEIVED.
    """
    _auth(client)
    quotation_id = await _issued_quotation(client, db)

    before = await client.get(f"/api/admin/quotations/{quotation_id}")
    assert before.json()["confirmation"]["paymentStatus"] == "pending"

    refused = await client.patch(
        f"/api/admin/quotations/{quotation_id}/payment", json={"status": "received"}
    )
    assert refused.status_code == 409
    assert "invoice" in refused.json()["detail"].lower()

    # And nothing moved: a refusal that half-applied would be worse than none.
    after = await client.get(f"/api/admin/quotations/{quotation_id}")
    assert after.json()["confirmation"]["paymentStatus"] == "pending"


async def test_payment_becomes_received_once_an_invoice_is_paid(client, db):
    """The replacement path, so the refusal above is not a dead end."""
    _auth(client)
    quotation_id = await _issued_quotation(client, db)
    await _paid_through_an_invoice(client, quotation_id)

    after = await client.get(f"/api/admin/quotations/{quotation_id}")
    assert after.json()["confirmation"]["paymentStatus"] == "received"


async def test_payment_status_rejects_an_unknown_value(client, db):
    _auth(client)
    quotation_id = await _issued_quotation(client, db)
    r = await client.patch(
        f"/api/admin/quotations/{quotation_id}/payment", json={"status": "partial"}
    )
    assert r.status_code == 422


async def test_receipt_email_requires_payment_to_be_received(client, db):
    """A receipt asserts money arrived. Emailing one for an unpaid order would
    put a claim in the customer's inbox that the business cannot support, so
    the rule is enforced here and not left to the UI hiding the button."""
    import base64
    from unittest.mock import AsyncMock, patch

    _auth(client)
    quotation_id = await _issued_quotation(client, db)

    with patch(
        "app.routers.admin_operations.email_integration.send_receipt",
        new=AsyncMock(return_value=True),
    ) as send:
        r = await client.post(
            f"/api/admin/quotations/{quotation_id}/receipt/email",
            json={"pdfBase64": base64.b64encode(b"%PDF-1.4 receipt").decode()},
        )

    assert r.status_code == 400
    assert send.await_count == 0


async def test_receipt_email_sends_the_supplied_pdf_once_paid(client, db):
    import base64
    from unittest.mock import AsyncMock, patch

    _auth(client)
    quotation_id = await _issued_quotation(client, db)
    await _paid_through_an_invoice(client, quotation_id)
    supplied = b"%PDF-1.4 receipt"

    with patch(
        "app.routers.admin_operations.email_integration.send_receipt",
        new=AsyncMock(return_value=True),
    ) as send:
        r = await client.post(
            f"/api/admin/quotations/{quotation_id}/receipt/email",
            json={"pdfBase64": base64.b64encode(supplied).decode()},
        )

    assert r.status_code == 200
    assert send.await_args.args[1] == supplied


async def test_receipt_email_requires_a_pdf(client, db):
    _auth(client)
    quotation_id = await _issued_quotation(client, db)
    await _paid_through_an_invoice(client, quotation_id)
    r = await client.post(f"/api/admin/quotations/{quotation_id}/receipt/email", json={})
    assert r.status_code == 422


async def test_emailing_rejects_a_non_pdf_attachment(client, db):
    """_decode_pdf guards every e-mail route: anything posted as an
    attachment is checked rather than trusted."""
    import base64

    _auth(client)
    quotation_id = await _issued_quotation(client, db)
    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/email",
        json={"pdfBase64": base64.b64encode(b"<html>nope").decode()},
    )
    assert r.status_code == 422


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


# --- Workflow stages --------------------------------------------------------
#
# The client's specification is Inbox -> Pending -> Submitted -> Order
# Confirmed. Each stage must be reachable and, more importantly, must not be
# skippable: the whole point of the intermediate stages is the audit trail
# they leave behind.


async def test_prepare_moves_inbox_to_pending_not_confirmed(client, db):
    """Prepare saves the priced offer and stops. Accepting it as an order is
    a separate decision the customer makes, not a side effect of pricing."""
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    assert (await client.get(f"/api/admin/quotations/{quotation_id}")).json()["status"] == "inbox"

    r = await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={
            "confirm": False,
            "refNumber": "Q-2026-001",
            "subject": "Drive supply",
            "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10, "unitPrice": 100.0}],
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] == "pending"
    # Priced, so the row shows a quoted total rather than a dash.
    assert r.json()["confirmation"]["grandTotal"] == 1000.0


async def test_preparing_twice_keeps_it_pending(client, db):
    """Editing a prepared quotation must not advance it — a correction before
    sending is still a quotation awaiting a send."""
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    body = {
        "confirm": False,
        "refNumber": "Q-2026-002",
        "subject": "Drive supply",
        "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10, "unitPrice": 100.0}],
    }
    await client.post(f"/api/admin/quotations/{quotation_id}/confirm", json=body)

    body["lines"][0]["unitPrice"] = 120.0
    r = await client.post(f"/api/admin/quotations/{quotation_id}/confirm", json=body)
    assert r.json()["status"] == "pending"
    assert r.json()["confirmation"]["grandTotal"] == 1200.0


async def test_confirm_accepts_a_prepared_quotation_as_an_order(client, db):
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    body = {
        "confirm": False,
        "refNumber": "Q-2026-003",
        "subject": "Drive supply",
        "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10, "unitPrice": 100.0}],
    }
    await client.post(f"/api/admin/quotations/{quotation_id}/confirm", json=body)

    body["confirm"] = True
    r = await client.post(f"/api/admin/quotations/{quotation_id}/confirm", json=body)
    assert r.json()["status"] == "confirmed"


async def test_work_order_is_stored_against_the_confirmed_order(client, db):
    """Step 13: the customer's own PO, kept with the order it authorised."""
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={
            "confirm": True,
            "refNumber": "Q-2026-004",
            "subject": "Drive supply",
            "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10, "unitPrice": 100.0}],
        },
    )

    r = await client.patch(
        f"/api/admin/quotations/{quotation_id}/work-order",
        json={"poNumber": "PO-778"},
    )
    assert r.status_code == 200
    assert r.json()["poNumber"] == "PO-778"

    # And it survives a re-read, rather than only echoing back in the response.
    assert (
        await client.get(f"/api/admin/quotations/{quotation_id}")
    ).json()["poNumber"] == "PO-778"
