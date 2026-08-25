from datetime import datetime, timezone

import pytest

from app.models import OrderConfirmation, Quotation
from app.services import billing as svc

NOW = datetime.now(timezone.utc)


async def _confirmed_order(db, lines=None):
    """A confirmed order with two lines: 10 of A, 5 of B."""
    lines = lines or [
        {"slug": "a", "name": "Part A", "quantity": 10, "unit": "Pcs", "unitPrice": 100.0},
        {"slug": "b", "name": "Part B", "quantity": 5, "unit": "Pcs", "unitPrice": 50.0},
    ]
    quotation = Quotation(
        items=[], total=0, details={"companyName": "Mahir Fabrics"},
        customer_email="a@x.com", status="confirmed", submitted_at=NOW,
    )
    db.add(quotation)
    await db.flush()
    db.add(
        OrderConfirmation(
            quotation_id=quotation.id, ref_number="AIT/MF/Q-0001/2026",
            issued_date="2026-08-01", tracking_id=f"TRK-{quotation.id[:8]}",
            lines=lines, grand_total=1250.0, terms={}, issued_at=NOW,
        )
    )
    await db.commit()
    await db.refresh(quotation)
    return quotation


# --- totals -----------------------------------------------------------------


def test_totals_apply_tax_after_discount():
    """A discounted customer is taxed on what they actually pay, not on the
    list price."""
    totals = svc.compute_totals(
        [{"quantity": 10, "unitPrice": 100.0}], discount=200.0, tax_rate=15.0
    )
    assert totals["subtotal"] == 1000.0
    assert totals["discount"] == 200.0
    assert totals["tax_amount"] == 120.0  # 15% of 800, not of 1000
    assert totals["grand_total"] == 920.0


def test_totals_add_other_charges_after_tax():
    """Freight is not itself taxed here — it is added to the payable figure."""
    totals = svc.compute_totals(
        [{"quantity": 1, "unitPrice": 100.0}], tax_rate=10.0, other_charges=50.0
    )
    assert totals["tax_amount"] == 10.0
    assert totals["grand_total"] == 160.0


def test_totals_default_to_no_tax():
    totals = svc.compute_totals([{"quantity": 2, "unitPrice": 25.0}])
    assert totals["tax_amount"] == 0.0
    assert totals["grand_total"] == 50.0


# --- quantity control -------------------------------------------------------


async def test_balances_start_at_the_full_ordered_quantity(db):
    quotation = await _confirmed_order(db)
    balances = {b["slug"]: b for b in await svc.order_balances(db, quotation)}
    assert balances["a"]["ordered"] == 10
    assert balances["a"]["delivered"] == 0
    assert balances["a"]["balance"] == 10


async def test_a_challan_reduces_the_remaining_balance(db):
    quotation = await _confirmed_order(db)
    await svc.create_challan(db, quotation, lines=[{"slug": "a", "quantity": 4}])

    balances = {b["slug"]: b for b in await svc.order_balances(db, quotation)}
    assert balances["a"]["delivered"] == 4
    assert balances["a"]["balance"] == 6
    # Untouched lines are unaffected.
    assert balances["b"]["balance"] == 5


async def test_multiple_challans_accumulate(db):
    """The whole point of partial delivery: one order, several shipments."""
    quotation = await _confirmed_order(db)
    await svc.create_challan(db, quotation, lines=[{"slug": "a", "quantity": 4}])
    await svc.create_challan(db, quotation, lines=[{"slug": "a", "quantity": 6}])

    balances = {b["slug"]: b for b in await svc.order_balances(db, quotation)}
    assert balances["a"]["delivered"] == 10
    assert balances["a"]["balance"] == 0


async def test_over_delivery_is_refused(db):
    """Shipping more than was ordered is the error this whole mechanism
    exists to prevent."""
    quotation = await _confirmed_order(db)
    with pytest.raises(svc.OverDelivery):
        await svc.create_challan(db, quotation, lines=[{"slug": "a", "quantity": 11}])


async def test_over_delivery_across_two_challans_is_refused(db):
    quotation = await _confirmed_order(db)
    await svc.create_challan(db, quotation, lines=[{"slug": "a", "quantity": 8}])
    with pytest.raises(svc.OverDelivery):
        await svc.create_challan(db, quotation, lines=[{"slug": "a", "quantity": 3}])


async def test_a_cancelled_challan_releases_its_quantities(db):
    """Cancelling a shipment must give the stock back to the balance, or the
    order could never be completed."""
    quotation = await _confirmed_order(db)
    challan = await svc.create_challan(db, quotation, lines=[{"slug": "a", "quantity": 10}])
    await svc.set_challan_status(db, challan, "cancelled")

    balances = {b["slug"]: b for b in await svc.order_balances(db, quotation)}
    assert balances["a"]["delivered"] == 0
    assert balances["a"]["balance"] == 10


async def test_editing_a_challan_does_not_count_against_itself(db):
    """Without excluding its own lines, re-saving an unchanged challan would
    read as a double delivery and be rejected."""
    quotation = await _confirmed_order(db)
    challan = await svc.create_challan(db, quotation, lines=[{"slug": "a", "quantity": 10}])

    updated = await svc.update_challan(
        db, challan, quotation, lines=[{"slug": "a", "quantity": 10}]
    )
    assert sum(l.quantity for l in updated.lines) == 10


async def test_a_line_not_on_the_order_is_refused(db):
    quotation = await _confirmed_order(db)
    with pytest.raises(svc.OverDelivery):
        await svc.create_challan(db, quotation, lines=[{"slug": "ghost", "quantity": 1}])


async def test_delivery_is_complete_only_when_every_line_ships(db):
    quotation = await _confirmed_order(db)
    await svc.create_challan(db, quotation, lines=[{"slug": "a", "quantity": 10}])
    assert await svc.delivery_is_complete(db, quotation) is False

    await svc.create_challan(db, quotation, lines=[{"slug": "b", "quantity": 5}])
    assert await svc.delivery_is_complete(db, quotation) is True


async def test_repeated_slugs_on_one_order_accumulate(db):
    """The same part quoted on two lines is one balance, not two."""
    quotation = await _confirmed_order(
        db,
        lines=[
            {"slug": "a", "name": "Part A", "quantity": 3, "unitPrice": 10.0},
            {"slug": "a", "name": "Part A", "quantity": 7, "unitPrice": 10.0},
        ],
    )
    balances = {b["slug"]: b for b in await svc.order_balances(db, quotation)}
    assert balances["a"]["ordered"] == 10


# --- invoices ---------------------------------------------------------------


async def test_invoice_starts_pending_without_a_number(db):
    """A draft must not consume a number out of the formal series."""
    quotation = await _confirmed_order(db)
    invoice = await svc.create_invoice(
        db, quotation, lines=[{"slug": "a", "quantity": 10, "unitPrice": 100.0}]
    )
    assert invoice.status == "pending"
    assert invoice.invoice_number is None
    assert invoice.grand_total == 1000.0


async def test_approving_assigns_a_number_and_date(db):
    quotation = await _confirmed_order(db)
    invoice = await svc.create_invoice(
        db, quotation, lines=[{"slug": "a", "quantity": 1, "unitPrice": 100.0}]
    )
    approved = await svc.approve_invoice(db, invoice, "Mahir Fabrics")
    assert approved.invoice_number is not None
    assert "/I-" in approved.invoice_number
    assert approved.invoice_date != ""


async def test_reapproving_keeps_the_original_number(db):
    """The customer may already be holding it."""
    quotation = await _confirmed_order(db)
    invoice = await svc.create_invoice(
        db, quotation, lines=[{"slug": "a", "quantity": 1, "unitPrice": 100.0}]
    )
    first = await svc.approve_invoice(db, invoice, "Mahir Fabrics")
    again = await svc.approve_invoice(db, first, "Mahir Fabrics")
    assert again.invoice_number == first.invoice_number


async def test_numbers_do_not_repeat_across_invoices(db):
    quotation = await _confirmed_order(db)
    a = await svc.create_invoice(db, quotation, lines=[{"slug": "a", "quantity": 1, "unitPrice": 1.0}])
    b = await svc.create_invoice(db, quotation, lines=[{"slug": "a", "quantity": 1, "unitPrice": 1.0}])
    a = await svc.approve_invoice(db, a, "X")
    b = await svc.approve_invoice(db, b, "X")
    assert a.invoice_number != b.invoice_number


async def test_partial_payment_sets_partially_paid(db):
    quotation = await _confirmed_order(db)
    invoice = await svc.create_invoice(
        db, quotation, lines=[{"slug": "a", "quantity": 10, "unitPrice": 100.0}]
    )
    invoice = await svc.approve_invoice(db, invoice, "X")
    invoice = await svc.record_payment(db, invoice, amount=400.0, method="bank")

    assert invoice.status == "partially_paid"
    assert invoice.amount_paid == 400.0


async def test_payments_accumulate_to_paid(db):
    """Status follows the arithmetic rather than a dropdown someone forgets."""
    quotation = await _confirmed_order(db)
    invoice = await svc.create_invoice(
        db, quotation, lines=[{"slug": "a", "quantity": 10, "unitPrice": 100.0}]
    )
    invoice = await svc.approve_invoice(db, invoice, "X")
    invoice = await svc.record_payment(db, invoice, amount=400.0)
    invoice = await svc.record_payment(db, invoice, amount=600.0)

    assert invoice.amount_paid == 1000.0
    assert invoice.status == "paid"
    assert len(invoice.payments) == 2


async def test_a_rounding_shortfall_still_counts_as_paid(db):
    """Float arithmetic must not leave an invoice permanently one paisa short."""
    quotation = await _confirmed_order(db)
    invoice = await svc.create_invoice(
        db, quotation, lines=[{"slug": "a", "quantity": 3, "unitPrice": 33.33}]
    )
    invoice = await svc.approve_invoice(db, invoice, "X")
    invoice = await svc.record_payment(db, invoice, amount=invoice.grand_total - 0.005)
    assert invoice.status == "paid"


async def test_invoiced_quantities_show_in_the_balances(db):
    quotation = await _confirmed_order(db)
    await svc.create_invoice(
        db, quotation, lines=[{"slug": "a", "quantity": 4, "unitPrice": 100.0}]
    )
    balances = {b["slug"]: b for b in await svc.order_balances(db, quotation)}
    assert balances["a"]["invoiced"] == 4
    assert balances["a"]["uninvoiced"] == 6
    # Billing is not shipping: the delivery balance is untouched.
    assert balances["a"]["balance"] == 10


async def test_editing_a_pending_invoice_recomputes_totals(db):
    quotation = await _confirmed_order(db)
    invoice = await svc.create_invoice(
        db, quotation, lines=[{"slug": "a", "quantity": 1, "unitPrice": 100.0}]
    )
    updated = await svc.update_invoice(
        db, invoice, lines=[{"slug": "a", "quantity": 2, "unitPrice": 100.0}], tax_rate=10.0
    )
    assert updated.subtotal == 200.0
    assert updated.tax_amount == 20.0
    assert updated.grand_total == 220.0
