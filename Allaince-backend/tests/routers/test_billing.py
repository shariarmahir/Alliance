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


async def test_delivery_alone_does_not_advance_an_unpaid_order(client, db):
    """Shipping everything is not enough on its own — the order still owes
    money, so the stage (and the Orders screen's dot meter) must not claim
    it's done."""
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
    assert quotation["confirmation"]["deliveryStage"] == 0


async def test_completing_delivery_and_payment_advances_the_order(client, db):
    """The order's own status only follows once it is both fully shipped and
    fully paid — the two must agree before the stage (and dot meter) call it
    Confirmed."""
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

    invoice = (
        await client.post(
            "/api/admin/invoices",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10,
                             "unitPrice": 100.0}]},
        )
    ).json()
    await client.post(f"/api/admin/invoices/{invoice['id']}/approve")

    quotation = (await client.get(f"/api/admin/quotations/{quotation_id}")).json()
    assert quotation["confirmation"]["deliveryStage"] == 0

    await client.post(
        f"/api/admin/invoices/{invoice['id']}/payments",
        json={"amount": 1000.0, "method": "bank", "reference": "TXN-1"},
    )

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


async def test_an_invoice_reaches_submitted_only_after_approval(client, db):
    """Items 17-19. Invoices are delivered to the customer outside this
    system, so Submit records that it has gone out. Approval still gates it:
    the number is what identifies the document, and submitting a nameless
    invoice would put one into the customer's hands."""
    quotation_id = await _confirmed(client)
    invoice = (
        await client.post(
            "/api/admin/invoices",
            json={"quotationId": quotation_id,
                  "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10,
                             "unitPrice": 100.0}]},
        )
    ).json()

    # Unapproved invoices carry no number, so there is nothing to submit.
    assert (await client.post(f"/api/admin/invoices/{invoice['id']}/submit")).status_code == 409

    approved = (await client.post(f"/api/admin/invoices/{invoice['id']}/approve")).json()
    assert approved["status"] == "pending"

    r = await client.post(f"/api/admin/invoices/{invoice['id']}/submit")
    assert r.status_code == 200
    assert r.json()["status"] == "submitted"
    assert r.json()["submittedAt"] is not None


async def test_invoice_cannot_be_completed_before_it_is_paid(client, db):
    """Section A item 24: Completed means "fully paid and all transactions
    completed". An unpaid invoice moved to Completed leaves money owed that
    no longer appears on any outstanding list."""
    quotation_id = await _confirmed(client)
    invoice = (await client.post(
        "/api/admin/invoices",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10,
                         "unitPrice": 100.0}]},
    )).json()

    r = await client.patch(
        f"/api/admin/invoices/{invoice['id']}/status", json={"status": "completed"}
    )
    assert r.status_code == 409


async def test_invoice_cannot_be_cancelled_after_payment(client, db):
    """Money has been received against this document. Cancelling it destroys
    the record the receipt is reconciled against."""
    quotation_id = await _confirmed(client)
    invoice = (await client.post(
        "/api/admin/invoices",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10,
                         "unitPrice": 100.0}]},
    )).json()
    await client.post(f"/api/admin/invoices/{invoice['id']}/approve")
    await client.post(
        f"/api/admin/invoices/{invoice['id']}/payments", json={"amount": 500.0}
    )

    r = await client.patch(
        f"/api/admin/invoices/{invoice['id']}/status", json={"status": "cancelled"}
    )
    assert r.status_code == 409


async def test_invoice_payment_status_cannot_be_set_by_hand(client, db):
    """Unpaid -> Partially Paid -> Paid is derived from the payments recorded.
    Setting it directly makes the badge disagree with the arithmetic."""
    quotation_id = await _confirmed(client)
    invoice = (await client.post(
        "/api/admin/invoices",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10,
                         "unitPrice": 100.0}]},
    )).json()
    await client.post(f"/api/admin/invoices/{invoice['id']}/approve")

    r = await client.patch(
        f"/api/admin/invoices/{invoice['id']}/status", json={"status": "paid"}
    )
    assert r.status_code == 409


async def test_challan_cannot_skip_dispatch(client, db):
    """Section B: Approve -> Dispatch -> Delivered. A challan marked Delivered
    without a dispatch has no vehicle, driver or delivery date recorded."""
    quotation_id = await _confirmed(client)
    challan = (await client.post(
        "/api/admin/challans",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 4}]},
    )).json()

    r = await client.patch(
        f"/api/admin/challans/{challan['id']}/status", json={"status": "delivered"}
    )
    assert r.status_code == 409


async def test_challan_cannot_be_cancelled_once_delivered(client, db):
    """The goods are with the customer. Cancelling returns the quantity to the
    balance, so the order would show stock still owed that has already gone."""
    quotation_id = await _confirmed(client)
    challan = (await client.post(
        "/api/admin/challans",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 4}]},
    )).json()
    await client.post(f"/api/admin/challans/{challan['id']}/approve")
    await client.post(
        f"/api/admin/challans/{challan['id']}/dispatch",
        json={"vehicleNumber": "DHK-1", "driverInfo": "Karim", "receiverName": "Store"},
    )
    await client.post(f"/api/admin/challans/{challan['id']}/deliver")

    r = await client.patch(
        f"/api/admin/challans/{challan['id']}/status", json={"status": "cancelled"}
    )
    assert r.status_code == 409


async def test_challan_cannot_be_dispatched_before_approval(client, db):
    """The dispatch endpoint guards this; the status endpoint must not be a
    way around it."""
    quotation_id = await _confirmed(client)
    challan = (await client.post(
        "/api/admin/challans",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 4}]},
    )).json()

    r = await client.patch(
        f"/api/admin/challans/{challan['id']}/status", json={"status": "dispatched"}
    )
    assert r.status_code == 409


async def test_an_order_cannot_be_billed_beyond_what_was_confirmed(client, db):
    """The challan side refuses over-delivery; the invoice side must refuse
    over-billing for the same reason. Ten were ordered, ten already invoiced,
    so a second invoice for ten more bills the customer twice for one order."""
    quotation_id = await _confirmed(client)
    line = {"slug": "drive-1", "name": "Drive", "quantity": 10, "unitPrice": 100.0}

    first = await client.post(
        "/api/admin/invoices", json={"quotationId": quotation_id, "lines": [line]}
    )
    assert first.status_code == 201

    second = await client.post(
        "/api/admin/invoices", json={"quotationId": quotation_id, "lines": [line]}
    )
    assert second.status_code == 400


async def test_a_draft_invoice_can_still_be_edited_up_to_the_full_order(client, db):
    """Guarding over-billing must not make normal editing impossible: raising
    a draft's own line back to the full ordered quantity has to keep working,
    because that draft's own quantities are not competition for itself."""
    quotation_id = await _confirmed(client)
    invoice = (await client.post(
        "/api/admin/invoices",
        json={"quotationId": quotation_id,
              "lines": [{"slug": "drive-1", "name": "Drive", "quantity": 4,
                         "unitPrice": 100.0}]},
    )).json()

    r = await client.patch(
        f"/api/admin/invoices/{invoice['id']}",
        json={"lines": [{"slug": "drive-1", "name": "Drive", "quantity": 10,
                         "unitPrice": 100.0}]},
    )
    assert r.status_code == 200
    assert r.json()["grandTotal"] == 1000.0

    # But one past the ordered quantity is still refused.
    over = await client.patch(
        f"/api/admin/invoices/{invoice['id']}",
        json={"lines": [{"slug": "drive-1", "name": "Drive", "quantity": 11,
                         "unitPrice": 100.0}]},
    )
    assert over.status_code == 400
