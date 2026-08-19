from datetime import datetime, timedelta, timezone

import pytest

from app.models import Category, Order, OrderConfirmation, Product, Quotation
from app.services.analytics import (
    bucket_starts,
    delta_pct,
    read_range_analytics,
    top_sellers,
)

NOW = datetime.now(timezone.utc)


def _order(days_ago: float, total: float, status="confirmed", name="Ada"):
    return Order(
        order_number=f"AIT-ORD-{days_ago}-{total}-{status}",
        tracking_id="T",
        items=[],
        subtotal=total,
        grand_total=total,
        address={"name": name},
        customer_name=name,
        status=status,
        placed_at=NOW - timedelta(days=days_ago),
    )


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
    db.add_all([_order(1, 100.0), _order(3, 200.0), _order(30, 999.0)])
    await db.commit()

    result = await read_range_analytics(db, "week")
    assert result.revenue == 300.0
    assert result.order_count == 2


async def test_cancelled_orders_are_excluded_from_revenue(db):
    db.add_all([_order(1, 100.0), _order(1, 500.0, status="cancelled")])
    await db.commit()

    result = await read_range_analytics(db, "week")
    # Cancelled money was never collected.
    assert result.revenue == 100.0
    assert result.order_count == 1


async def test_delta_compares_against_the_preceding_window(db):
    db.add_all([_order(1, 200.0), _order(9, 100.0)])  # 9 days ago = previous week
    await db.commit()

    result = await read_range_analytics(db, "week")
    assert result.revenue == 200.0
    assert result.revenue_delta_pct == 100.0


async def test_delta_is_none_without_a_baseline(db):
    db.add(_order(1, 200.0))
    await db.commit()
    assert (await read_range_analytics(db, "week")).revenue_delta_pct is None


async def test_trend_buckets_align_with_the_window(db):
    db.add(_order(0, 100.0))
    await db.commit()

    result = await read_range_analytics(db, "week")
    assert len(result.revenue_trend) == 7
    # Today's order lands in the final bucket.
    assert result.revenue_trend[-1].value == 100.0
    assert sum(p.value for p in result.revenue_trend) == 100.0


async def test_active_clients_dedupes_across_orders_and_quotations(db):
    db.add_all([_order(1, 10.0, name="Ada"), _order(2, 10.0, name="ada")])
    db.add(
        Quotation(
            items=[], total=0, details={"email": "ADA@example.com"},
            customer_email="ada@example.com", submitted_at=NOW - timedelta(days=1),
        )
    )
    await db.commit()

    result = await read_range_analytics(db, "week")
    # "Ada"/"ada" and the quotation email are one client each, case-insensitively.
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
