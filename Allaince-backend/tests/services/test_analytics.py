from datetime import datetime, timedelta, timezone

import pytest

from app.models import Category, OrderConfirmation, Product, Quotation
from app.services.analytics import (
    bucket_starts,
    delta_pct,
    read_payment_analytics,
    read_range_analytics,
    top_sellers,
)

NOW = datetime.now(timezone.utc)

_seq = 0


async def _order(
    db,
    days_ago: float,
    total: float,
    status="confirmed",
    email="ada@example.com",
    payment_status="pending",
    paid_days_ago: float | None = None,
):
    """A confirmed order: a quotation plus the confirmation carrying its money.

    Revenue and payments both read confirmations rather than the `orders`
    table, so the fixtures build what the services actually aggregate.
    """
    global _seq
    _seq += 1
    quotation = Quotation(
        items=[],
        total=total,
        details={"email": email},
        customer_email=email,
        status=status,
        submitted_at=NOW - timedelta(days=days_ago),
    )
    db.add(quotation)
    await db.flush()
    db.add(
        OrderConfirmation(
            quotation_id=quotation.id,
            ref_number=f"AIT/M/Q-{_seq:04d}/2026",
            issued_date="2026-08-01",
            tracking_id=f"TRK-{_seq}",
            lines=[],
            grand_total=total,
            terms={},
            issued_at=NOW - timedelta(days=days_ago),
            payment_status=payment_status,
            payment_received_at=(
                None if paid_days_ago is None else NOW - timedelta(days=paid_days_ago)
            ),
        )
    )
    return quotation


# --- pure helpers -----------------------------------------------------------


@pytest.mark.parametrize(
    "current,previous,expected",
    [
        (150, 100, 50.0),
        (50, 100, -50.0),
        (100, 100, 0.0),
        (0, 0, 0.0),
        # No baseline is "no basis for comparison", not "flat".
        (100, 0, None),
    ],
)
def test_delta_pct(current, previous, expected):
    assert delta_pct(current, previous) == expected


@pytest.mark.parametrize("range_,count", [("week", 7), ("month", 30), ("year", 12)])
def test_bucket_counts(range_, count):
    assert len(bucket_starts(range_, NOW)) == count


def test_buckets_are_ordered_oldest_first_and_end_today():
    starts = bucket_starts("week", NOW)
    assert starts == sorted(starts)
    assert starts[-1].date() == NOW.date()


# --- windowing --------------------------------------------------------------


async def test_revenue_counts_only_the_current_window(db):
    await _order(db, 1, 100.0)
    await _order(db, 3, 200.0)
    await _order(db, 30, 999.0)
    await db.commit()

    result = await read_range_analytics(db, "week")
    assert result.revenue == 300.0
    assert result.order_count == 2


async def test_cancelled_orders_are_excluded_from_revenue(db):
    await _order(db, 1, 100.0)
    await _order(db, 1, 500.0, status="cancelled")
    await db.commit()

    result = await read_range_analytics(db, "week")
    # Cancelled money was never collected.
    assert result.revenue == 100.0
    assert result.order_count == 1


async def test_revenue_reads_confirmed_orders_not_the_dead_orders_table(db):
    """The `orders` table was fed by a customer checkout flow that no longer
    exists, so revenue read from it was always zero while the business was
    taking orders. A confirmed quotation is the real sale, and is what the
    Orders screen and payment tracking both work from."""
    await _order(db, 1, 750.0)
    await db.commit()

    assert (await read_range_analytics(db, "week")).revenue == 750.0


async def test_a_quotation_without_a_confirmation_is_not_revenue(db):
    """An unpriced request is not a sale."""
    db.add(
        Quotation(
            items=[], total=500.0, details={"email": "x@x.com"},
            customer_email="x@x.com", submitted_at=NOW - timedelta(days=1),
        )
    )
    await db.commit()

    result = await read_range_analytics(db, "week")
    assert result.revenue == 0.0
    assert result.order_count == 0


async def test_delta_compares_against_the_preceding_window(db):
    await _order(db, 1, 200.0)
    await _order(db, 9, 100.0)  # 9 days ago = previous week
    await db.commit()

    result = await read_range_analytics(db, "week")
    assert result.revenue == 200.0
    assert result.revenue_delta_pct == 100.0


async def test_delta_is_none_without_a_baseline(db):
    await _order(db, 1, 200.0)
    await db.commit()
    assert (await read_range_analytics(db, "week")).revenue_delta_pct is None


async def test_trend_buckets_align_with_the_window(db):
    await _order(db, 0, 100.0)
    await db.commit()

    result = await read_range_analytics(db, "week")
    assert len(result.revenue_trend) == 7
    # Today's order lands in the final bucket.
    assert result.revenue_trend[-1].value == 100.0
    assert sum(p.value for p in result.revenue_trend) == 100.0


async def test_active_clients_dedupes_across_orders_and_quotations(db):
    await _order(db, 1, 10.0, email="Ada@example.com")
    await _order(db, 2, 10.0, email="ada@example.com")
    db.add(
        Quotation(
            items=[], total=0, details={"email": "other@example.com"},
            customer_email="other@example.com", submitted_at=NOW - timedelta(days=1),
        )
    )
    await db.commit()

    result = await read_range_analytics(db, "week")
    # The two orders are one client (same address, different case); the
    # standalone request is a second.
    assert result.active_clients == 2


async def test_quotations_are_counted_and_bucketed(db):
    for days in (1, 2, 40):
        db.add(
            Quotation(
                items=[], total=0, details={"email": f"c{days}@x.com"},
                customer_email=f"c{days}@x.com", submitted_at=NOW - timedelta(days=days),
            )
        )
    await db.commit()

    result = await read_range_analytics(db, "week")
    assert result.quotation_count == 2


# --- payments ---------------------------------------------------------------


async def test_received_is_bucketed_by_when_payment_arrived(db):
    """An order issued long ago but paid today counts as today's money, so the
    totals reconcile against a bank statement rather than against invoices."""
    await _order(db, 90, 500.0, payment_status="received", paid_days_ago=0)
    await db.commit()

    result = await read_payment_analytics(db, "week")
    assert result.received == 500.0
    assert result.received_count == 1
    assert result.received_trend[-1].value == 500.0


async def test_received_outside_the_window_is_excluded(db):
    await _order(db, 40, 300.0, payment_status="received", paid_days_ago=40)
    await db.commit()

    assert (await read_payment_analytics(db, "week")).received == 0.0


async def test_pending_is_the_full_outstanding_balance_not_a_window(db):
    """An invoice issued last year is still owed today, so the pending total
    counts every unpaid order even though its chart is windowed."""
    await _order(db, 400, 250.0)
    await _order(db, 1, 100.0)
    await db.commit()

    result = await read_payment_analytics(db, "week")
    assert result.pending == 350.0
    assert result.pending_count == 2
    # Only the recent one can be placed in a 7-day chart.
    assert sum(p.value for p in result.pending_trend) == 100.0


async def test_paid_orders_are_not_also_counted_as_pending(db):
    await _order(db, 1, 100.0, payment_status="received", paid_days_ago=1)
    await db.commit()

    result = await read_payment_analytics(db, "week")
    assert result.received == 100.0
    assert result.pending == 0.0
    assert result.pending_count == 0


async def test_cancelled_orders_count_as_neither_received_nor_owed(db):
    await _order(db, 1, 900.0, status="cancelled")
    await db.commit()

    result = await read_payment_analytics(db, "week")
    assert result.pending == 0.0
    assert result.received == 0.0


async def test_payment_marked_received_without_a_timestamp_still_counts(db):
    """Rows marked paid before the timestamp column existed carry real money;
    dropping them from the total would understate what was collected, even
    though they cannot be placed in a bucket."""
    await _order(db, 1, 400.0, payment_status="received", paid_days_ago=None)
    await db.commit()

    result = await read_payment_analytics(db, "week")
    assert result.received == 400.0
    assert result.received_count == 1
    assert sum(p.value for p in result.received_trend) == 0.0


async def test_received_delta_compares_against_the_previous_window(db):
    await _order(db, 1, 200.0, payment_status="received", paid_days_ago=1)
    await _order(db, 9, 100.0, payment_status="received", paid_days_ago=9)
    await db.commit()

    result = await read_payment_analytics(db, "week")
    assert result.received == 200.0
    assert result.received_delta_pct == 100.0


@pytest.mark.parametrize("range_,count", [("week", 7), ("month", 30), ("year", 12)])
async def test_payment_trends_have_a_bucket_per_range(db, range_, count):
    result = await read_payment_analytics(db, range_)
    assert len(result.received_trend) == count
    assert len(result.pending_trend) == count


async def test_payments_and_revenue_agree_on_the_same_orders(db):
    """The Orders screen and the Overview must not disagree about money: what
    revenue reports as sold is exactly what payments splits into collected
    and owed."""
    await _order(db, 1, 300.0, payment_status="received", paid_days_ago=1)
    await _order(db, 2, 200.0)
    await db.commit()

    revenue = (await read_range_analytics(db, "week")).revenue
    payments = await read_payment_analytics(db, "week")
    assert revenue == 500.0
    assert payments.received + payments.pending == revenue


# --- top sellers ------------------------------------------------------------


async def _catalog(db):
    db.add(Category(slug="plc", name="PLC"))
    await db.flush()
    for slug in ("alpha", "beta"):
        db.add(
            Product(
                slug=slug, part_number=f"PN-{slug}", name=slug.title(),
                brand="b", category_slug="plc",
            )
        )
    await db.commit()


async def test_top_sellers_aggregates_confirmed_lines(db):
    await _catalog(db)
    quotation = Quotation(items=[], total=0, details={}, submitted_at=NOW)
    db.add(quotation)
    await db.flush()
    db.add(
        OrderConfirmation(
            quotation_id=quotation.id, ref_number="R1", issued_date="2026-08-01",
            tracking_id="TRK-1", grand_total=0, terms={}, issued_at=NOW - timedelta(days=2),
            lines=[
                {"slug": "alpha", "quantity": 3},
                {"slug": "beta", "quantity": 10},
            ],
        )
    )
    await db.commit()

    ranked = await top_sellers(db, period="month")
    assert [t.product.slug for t in ranked] == ["beta", "alpha"]
    assert [t.quantity_sold for t in ranked] == [10, 3]


async def test_top_sellers_respects_the_period_window(db):
    await _catalog(db)
    quotation = Quotation(items=[], total=0, details={}, submitted_at=NOW)
    db.add(quotation)
    await db.flush()
    db.add(
        OrderConfirmation(
            quotation_id=quotation.id, ref_number="R1", issued_date="2026-01-01",
            tracking_id="TRK-OLD", grand_total=0, terms={},
            issued_at=NOW - timedelta(days=200),
            lines=[{"slug": "alpha", "quantity": 5}],
        )
    )
    await db.commit()

    assert await top_sellers(db, period="week") == []
    assert len(await top_sellers(db, period="year")) == 1


async def test_top_sellers_is_empty_without_confirmations(db):
    await _catalog(db)
    assert await top_sellers(db) == []


async def test_top_sellers_ignores_lines_for_deleted_products(db):
    await _catalog(db)
    quotation = Quotation(items=[], total=0, details={}, submitted_at=NOW)
    db.add(quotation)
    await db.flush()
    db.add(
        OrderConfirmation(
            quotation_id=quotation.id, ref_number="R", issued_date="2026-08-01",
            tracking_id="TRK-2", grand_total=0, terms={}, issued_at=NOW,
            lines=[{"slug": "gone-from-catalog", "quantity": 99}, {"slug": "alpha", "quantity": 1}],
        )
    )
    await db.commit()

    ranked = await top_sellers(db)
    assert [t.product.slug for t in ranked] == ["alpha"]
