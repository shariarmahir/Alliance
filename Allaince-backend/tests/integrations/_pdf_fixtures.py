"""Document fixtures for the PDF tests.

A module rather than fixtures in the test file, because the render tests run
each document in a fresh subprocess and need to import these there too.
"""


class _Confirmation:
    ref_number = "AIT/MFL/Q-0418/2026"
    subject = "Financial Offer for supply of Siemens Drive X"
    issued_date = "2026-08-19"
    tracking_id = "AIT-TRK-ABCD1234"
    grand_total = 210000.0
    lines = [
        {
            "name": "Siemens Drive X",
            "partNumber": "PN-A",
            "specifications": "400V 3-phase, IP55",
            "quantity": 4,
            "unit": "Pcs",
            "unitPrice": 52500.0,
            "total": 210000.0,
        }
    ]
    terms = {
        "payment": "100% Cash/Pay order.",
        "delivery": "From Ready Stock",
        "offerValidity": "07 days, From the Offer Date.",
        "vatAit": "Excluded.",
        "stock": "Available.",
        "installationCharge": "Free.",
        "warranty": "12 Months Warranty (From the date of delivery)",
    }


class _Quotation:
    id = "11111111-2222-3333-4444-555555555555"
    items = [{"name": "Siemens Drive X", "partNumber": "PN-A", "quantity": 4}]
    details = {
        "fullName": "Grace Hopper",
        "email": "grace@navy.mil",
        "phone": "+8801700000000",
        "companyName": "Mahir Fabrics Ltd",
        "submittedAt": "2026-08-18T10:00:00Z",
    }
    confirmation = _Confirmation()


class _Order:
    order_number = "AIT-ORD-9Z8Y7X6W"
    tracking_id = "AIT-TRK-9Z8Y7X6W"
    placed_at = "2026-08-19T09:30:00Z"
    subtotal = 200000.0
    shipping_cost = 2500.0
    grand_total = 202500.0
    delivery_option = "express"
    delivery_option_name = "Express"
    items = [
        {"name": "Siemens Drive X", "partNumber": "PN-A", "quantity": 4, "price": 50000.0}
    ]
    address = {
        "name": "Grace Hopper",
        "line": "House 104, Road 15",
        "city": "Dhaka",
        "country": "Bangladesh",
        "phone": "+8801700000000",
    }


def make_quotation(confirmed: bool = True) -> _Quotation:
    quotation = _Quotation()
    quotation.details = dict(_Quotation.details)
    quotation.confirmation = _Confirmation() if confirmed else None
    return quotation


def make_order() -> _Order:
    return _Order()
