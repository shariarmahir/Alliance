from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.schemas.session import AdminSession

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
