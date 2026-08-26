import pytest

from app.core.rate_limit import reset_in_memory_buckets
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.schemas.session import AdminSession


# Every test here raises its order through the public storefront endpoint,
# which is rate limited because anyone on the internet can reach it. Without
# this the suite trips its own throttle partway through and the failures
# look like billing bugs.
@pytest.fixture(autouse=True)
def _clear_rate_limits():
    reset_in_memory_buckets()
    yield
    reset_in_memory_buckets()

QUOTE_PAYLOAD = {
    "items": [
        {
            "slug": "drive-1", "partNumber": "PN-A", "name": "Siemens Drive",
            "brand": "siemens", "image": "/i.jpg", "price": 100.0, "quantity": 10,
        }
    ],
    "details": {
        "fullName": "Ada Lovelace", "email": "ada@example.com",
        "phone": "+8801700000000", "companyName": "Mahir Fabrics Ltd",
        "country": "Bangladesh", "preferredContact": "email", "leadTime": "standard",
    },
}


def _auth(client, role="super", **kwargs):
    session = AdminSession(role=role, name="Admin", email="a@x.com", **kwargs)
    client.cookies.set(ADMIN_SESSION_COOKIE, create_session_token(session))


async def _confirmed(client):
    """A quotation taken all the way to confirmed, ready to bill or ship."""
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)
    await client.post(
        f"/api/admin/quotations/{quotation_id}/confirm",
        json={
            "confirm": True,
            "lines": [{"slug": "drive-1", "name": "Siemens Drive", "quantity": 10,
                       "unitPrice": 100.0}],
        },
    )
    return quotation_id


async def test_documents_require_a_confirmed_order(client, db):
    """Both documents start from Order Confirmed — that is the rule the whole
    workflow is built on."""
    quotation_id = (await client.post("/api/quotations", json=QUOTE_PAYLOAD)).json()["id"]
    _auth(client)

    r = await client.post(
        "/api/admin/invoices",
        json={"quotationId": quotation_id, "lines": [{"quantity": 1, "unitPrice": 1.0}]},
    )
    assert r.status_code == 400


async def test_invoice_lifecycle(client, db):
    quotation_id = await _confirmed(client)

    created = await client.post(
        "/api/admin/invoices",
        json={
            "quotationId": quotation_id,
            "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10, "unitPrice": 100.0}],
            "taxRate": 15.0,
        },
    )
    assert created.status_code == 201
    invoice = created.json()
    assert invoice["status"] == "pending"
    assert invoice["invoiceNumber"] is None
    assert invoice["taxAmount"] == 150.0
    assert invoice["grandTotal"] == 1150.0

    approved = await client.post(f"/api/admin/invoices/{invoice['id']}/approve")
    assert approved.json()["invoiceNumber"] is not None

    paid = await client.post(
        f"/api/admin/invoices/{invoice['id']}/payments",
        json={"amount": 1150.0, "method": "bank", "reference": "TXN-1"},
    )
    assert paid.json()["status"] == "paid"
    assert paid.json()["amountPaid"] == 1150.0


async def test_an_approved_invoice_cannot_be_edited(client, db):
    """The number is out with the customer; a correction is a new document."""
    quotation_id = await _confirmed(client)
    invoice = (
        await client.post(
            "/api/admin/invoices",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "quantity": 1, "unitPrice": 100.0}]},
        )
    ).json()
    await client.post(f"/api/admin/invoices/{invoice['id']}/approve")

    r = await client.patch(
        f"/api/admin/invoices/{invoice['id']}", json={"otherCharges": 50.0}
    )
    assert r.status_code == 409


async def test_payment_requires_approval_first(client, db):
    """Money must not be recorded against a document that has no number."""
    quotation_id = await _confirmed(client)
    invoice = (
        await client.post(
            "/api/admin/invoices",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "quantity": 1, "unitPrice": 100.0}]},
        )
    ).json()

    r = await client.post(
        f"/api/admin/invoices/{invoice['id']}/payments", json={"amount": 10.0}
    )
    assert r.status_code == 400


async def test_challan_lifecycle_and_partial_delivery(client, db):
    quotation_id = await _confirmed(client)

    first = await client.post(
        "/api/admin/challans",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 4}]},
    )
    assert first.status_code == 201
    challan = first.json()
    assert challan["status"] == "pending"

    balances = (
        await client.get(f"/api/admin/quotations/{quotation_id}/balances")
    ).json()
    assert balances[0]["delivered"] == 4
    assert balances[0]["balance"] == 6

    await client.post(f"/api/admin/challans/{challan['id']}/approve")
    dispatched = await client.post(
        f"/api/admin/challans/{challan['id']}/dispatch",
        json={"vehicleNumber": "DH-1234", "driverInfo": "Karim", "receiverName": "Store"},
    )
    assert dispatched.json()["status"] == "dispatched"
    assert dispatched.json()["vehicleNumber"] == "DH-1234"

    delivered = await client.post(f"/api/admin/challans/{challan['id']}/deliver")
    assert delivered.json()["status"] == "delivered"


async def test_over_delivery_is_rejected_by_the_api(client, db):
    quotation_id = await _confirmed(client)
    r = await client.post(
        "/api/admin/challans",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "quantity": 11}]},
    )
    assert r.status_code == 400
    assert "left to deliver" in r.json()["detail"]


async def test_completing_delivery_advances_the_order(client, db):
    """When the last unit ships, the order's own delivery status follows."""
    quotation_id = await _confirmed(client)
    challan = (
        await client.post(
            "/api/admin/challans",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "quantity": 10}]},
        )
    ).json()
    await client.post(f"/api/admin/challans/{challan['id']}/approve")
    await client.post(f"/api/admin/challans/{challan['id']}/deliver")

    quotation = (await client.get(f"/api/admin/quotations/{quotation_id}")).json()
    assert quotation["confirmation"]["deliveryStage"] == 1


async def test_dispatch_requires_approval(client, db):
    quotation_id = await _confirmed(client)
    challan = (
        await client.post(
            "/api/admin/challans",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "quantity": 1}]},
        )
    ).json()

    r = await client.post(
        f"/api/admin/challans/{challan['id']}/dispatch", json={"vehicleNumber": "X"}
    )
    assert r.status_code == 400


async def test_billing_requires_authentication(client, db):
    assert (await client.get("/api/admin/invoices")).status_code == 401
    assert (await client.get("/api/admin/challans")).status_code == 401


async def test_invoice_list_filters_by_status(client, db):
    quotation_id = await _confirmed(client)
    await client.post(
        "/api/admin/invoices",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "quantity": 1, "unitPrice": 100.0}]},
    )

    pending = (await client.get("/api/admin/invoices?status_filter=pending")).json()
    assert len(pending) == 1
    paid = (await client.get("/api/admin/invoices?status_filter=paid")).json()
    assert paid == []


# --- Documents and history --------------------------------------------------


async def test_invoice_pdf_renders(client, db):
    """The formal Invoice document, which the client's specification requires
    to be printable, downloadable and e-mailable."""
    quotation_id = await _confirmed(client)
    invoice = (
        await client.post(
            "/api/admin/invoices",
            json={
                "quotationId": quotation_id,
                "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10,
                           "unitPrice": 100.0}],
                "taxRate": 15.0,
            },
        )
    ).json()

    r = await client.get(f"/api/admin/invoices/{invoice['id']}/pdf")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    # A real PDF, not an error page rendered with the wrong content type.
    assert r.content[:4] == b"%PDF"


async def test_challan_pdf_excludes_its_own_lines_from_previously_delivered(client, db):
    """The quantity-control table reads
    Ordered -> Previously Delivered -> This Delivery -> Balance.

    'Previously delivered' must mean prior challans. Counting the document's
    own lines would make every printed balance short by exactly the quantity
    on the page, which is the figure a driver checks the load against.
    """
    quotation_id = await _confirmed(client)

    first = (
        await client.post(
            "/api/admin/challans",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 4}]},
        )
    ).json()
    await client.post(f"/api/admin/challans/{first['id']}/approve")
    await client.post(f"/api/admin/challans/{first['id']}/dispatch", json={"vehicleNumber": "V1"})
    await client.post(f"/api/admin/challans/{first['id']}/deliver", json={})

    second = (
        await client.post(
            "/api/admin/challans",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 3}]},
        )
    ).json()

    r = await client.get(f"/api/admin/challans/{second['id']}/pdf")
    assert r.status_code == 200
    assert r.content[:4] == b"%PDF"

    # Asserting on the renderer's own inputs, not on a sibling endpoint that
    # happens to agree with it: the figures printed on the page are the ones
    # under test, so this reads them the way the endpoint builds them.
    from app.integrations import pdf as pdf_module
    from app.models.operations import Challan
    from app.services import billing as billing_svc
    from app.services import operations as ops_svc
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    challan = (
        await db.execute(
            select(Challan)
            .options(selectinload(Challan.lines))
            .where(Challan.id == second["id"])
        )
    ).scalar_one()
    quotation = await ops_svc.get_quotation(db, quotation_id)
    rows = await billing_svc.order_balances(db, quotation, exclude_challan=challan.id)
    balances = {row["slug"]: row for row in rows}

    # 10 ordered, 4 shipped on the first challan. This challan's own 3 must
    # not count as prior delivery.
    assert balances["drive-1"]["ordered"] == 10
    assert balances["drive-1"]["delivered"] == 4

    captured: dict = {}
    original = pdf_module._render_html
    pdf_module._render_html = lambda html: captured.setdefault("html", html) and b"%PDF"
    try:
        pdf_module.render_challan_document_pdf(challan, quotation, balances)
    finally:
        pdf_module._render_html = original

    # Ordered 10, previously 4, this delivery 3, so 3 still owed after it.
    row_cells = captured["html"].split("<tbody>")[1].split("</tbody>")[0]
    assert ">10<" in row_cells  # ordered
    assert ">4<" in row_cells  # previously delivered
    assert "<strong>3</strong>" in row_cells  # this delivery
    assert ">3<" in row_cells  # balance remaining


async def test_order_history_assembles_the_whole_paper_trail(client, db):
    """Section C: complete traceability from enquiry to delivery, in one
    place rather than spread over four screens."""
    quotation_id = await _confirmed(client)

    await client.post(
        "/api/admin/invoices",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "quantity": 10, "unitPrice": 100.0}]},
    )
    await client.post(
        "/api/admin/challans",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "quantity": 5}]},
    )
    await client.patch(
        f"/api/admin/quotations/{quotation_id}/work-order",
        json={"poNumber": "PO-2026-0142"},
    )

    history = (await client.get(f"/api/admin/quotations/{quotation_id}/history")).json()
    kinds = [e["kind"] for e in history["events"]]

    assert "request" in kinds
    assert "quotation" in kinds
    assert "confirmed" in kinds
    assert "po" in kinds
    assert "invoice" in kinds
    assert "challan" in kinds
    assert history["poNumber"] == "PO-2026-0142"


async def test_order_history_only_covers_its_own_order(client, db):
    """Two orders running at once must not show each other's documents."""
    first = await _confirmed(client)
    second = await _confirmed(client)

    await client.post(
        "/api/admin/invoices",
        json={"quotationId": first,
              "lines": [{"slug": "drive-1", "quantity": 1, "unitPrice": 100.0}]},
    )

    history = (await client.get(f"/api/admin/quotations/{second}/history")).json()
    assert [e for e in history["events"] if e["kind"] == "invoice"] == []


async def test_document_pdfs_require_authentication(client, db):
    assert (await client.get("/api/admin/invoices/x/pdf")).status_code == 401
    assert (await client.get("/api/admin/challans/x/pdf")).status_code == 401
    assert (await client.get("/api/admin/quotations/x/history")).status_code == 401


async def test_invoice_reaches_submitted_only_on_a_confirmed_send(client, db, monkeypatch):
    """Items 17-19. mark_invoice_submitted existed but was wired to nothing,
    so an invoice went pending -> paid and the Submitted tab could never
    fill. The status must move on a delivered e-mail, and only then."""
    quotation_id = await _confirmed(client)
    invoice = (
        await client.post(
            "/api/admin/invoices",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10,
                             "unitPrice": 100.0}]},
        )
    ).json()

    # Unapproved invoices carry no number, so there is nothing to send.
    assert (await client.post(f"/api/admin/invoices/{invoice['id']}/send")).status_code == 409

    approved = (await client.post(f"/api/admin/invoices/{invoice['id']}/approve")).json()
    assert approved["status"] == "pending"

    from app.integrations import email as email_integration

    async def _fails(*args, **kwargs):
        return False

    monkeypatch.setattr(email_integration, "send_invoice", _fails)
    r = await client.post(f"/api/admin/invoices/{invoice['id']}/send")
    assert r.status_code == 502
    # Still pending: an invoice recorded as sent to a customer who never got
    # it is worse than one that still looks outstanding, because nobody
    # chases it.
    assert (
        await client.get(f"/api/admin/invoices/{invoice['id']}")
    ).json()["status"] == "pending"

    async def _succeeds(*args, **kwargs):
        return True

    monkeypatch.setattr(email_integration, "send_invoice", _succeeds)
    r = await client.post(f"/api/admin/invoices/{invoice['id']}/send")
    assert r.status_code == 200
    assert r.json()["status"] == "submitted"
    assert r.json()["submittedAt"] is not None


async def test_invoice_email_carries_its_own_figures(client, db, monkeypatch):
    """send_invoice took only a quotation, so it derived a reference that
    appeared on no record and quoted the quotation's total. A partial
    invoice was therefore billed for the whole order."""
    quotation_id = await _confirmed(client)
    # Half the order: 4 of the 10 units.
    invoice = (
        await client.post(
            "/api/admin/invoices",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 4,
                             "unitPrice": 100.0}]},
        )
    ).json()
    approved = (await client.post(f"/api/admin/invoices/{invoice['id']}/approve")).json()

    captured: dict = {}
    from app.integrations import email as email_integration

    async def _capture(quotation, pdf_bytes=None, invoice=None):
        captured["invoice"] = invoice
        return True

    monkeypatch.setattr(email_integration, "send_invoice", _capture)
    await client.post(f"/api/admin/invoices/{invoice['id']}/send")

    # The real invoice, not the quotation it was raised against.
    assert captured["invoice"] is not None
    assert captured["invoice"].invoice_number == approved["invoiceNumber"]
    assert captured["invoice"].grand_total == 400.0


async def test_editing_an_approved_invoice_is_refused(client, db):
    """The number is on a document the customer may already hold."""
    quotation_id = await _confirmed(client)
    invoice = (
        await client.post(
            "/api/admin/invoices",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "quantity": 10, "unitPrice": 100.0}]},
        )
    ).json()
    await client.post(f"/api/admin/invoices/{invoice['id']}/approve")

    r = await client.patch(
        f"/api/admin/invoices/{invoice['id']}",
        json={"lines": [{"slug": "drive-1", "quantity": 1, "unitPrice": 1.0}]},
    )
    assert r.status_code == 409


async def test_challan_send_requires_approval_and_leaves_status_alone(
    client, db, monkeypatch
):
    """A challan becomes Dispatched when goods leave, which sending an
    e-mail does not cause."""
    quotation_id = await _confirmed(client)
    challan = (
        await client.post(
            "/api/admin/challans",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 5}]},
        )
    ).json()

    assert (await client.post(f"/api/admin/challans/{challan['id']}/send")).status_code == 409

    await client.post(f"/api/admin/challans/{challan['id']}/approve")

    from app.integrations import email as email_integration

    async def _succeeds(*args, **kwargs):
        return True

    monkeypatch.setattr(email_integration, "send_challan", _succeeds)
    r = await client.post(f"/api/admin/challans/{challan['id']}/send")
    assert r.status_code == 200
    assert r.json()["status"] == "pending"
