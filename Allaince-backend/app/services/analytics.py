from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ContactRequest, DeletedOrder, OrderConfirmation, Product, Quotation
from app.services import operations as ops
from app.schemas.analytics import (
    AnalyticsRange,
    CountryBreakdown,
    NavCounts,
    OrderRatioSlice,
    PaymentAnalytics,
    RangeAnalytics,
    StockAlert,
    StockStatusBreakdown,
    TrendPoint,
)
from app.schemas.catalog import ProductOut, TopSellerOut

# Buckets per range, and how far back each window reaches. Rolling rather than
# calendar-aligned, so the chart always has a full set of buckets regardless of
# today's date.
RANGE_CONFIG: dict[AnalyticsRange, tuple[int, str]] = {
    "week": (7, "day"),
    "month": (30, "day"),
    "year": (12, "month"),
}


def _start_of_day(d: datetime) -> datetime:
    return d.replace(hour=0, minute=0, second=0, microsecond=0)


def _start_of_month(d: datetime) -> datetime:
    return d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _add_months(d: datetime, months: int) -> datetime:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    return d.replace(year=year, month=month)


def bucket_starts(range_: AnalyticsRange, now: datetime) -> list[datetime]:
    """Bucket boundaries, oldest first, ending with the one containing `now`."""
    buckets, unit = RANGE_CONFIG[range_]
    starts: list[datetime] = []
    for i in range(buckets - 1, -1, -1):
        if unit == "day":
            starts.append(_start_of_day(now) - timedelta(days=i))
        else:
            starts.append(_add_months(_start_of_month(now), -i))
    return starts


def _bucket_label(d: datetime, unit: str) -> str:
    # Matches the frontend's en-GB formatting: "05 Aug" for days, "Aug" for months.
    return f"{d.day:02d} {d.strftime('%b')}" if unit == "day" else d.strftime("%b")


def _bucket_index_for(ts: datetime, starts: list[datetime]) -> int:
    """Index of the bucket a timestamp falls into, or -1 when it predates the
    window. Buckets are contiguous, so the last start <= ts wins."""
    index = -1
    for i, start in enumerate(starts):
        if ts >= start:
            index = i
        else:
            break
    return index


def _previous_window(range_: AnalyticsRange, now: datetime) -> tuple[datetime, datetime]:
    current_start = bucket_starts(range_, now)[0]
    buckets, unit = RANGE_CONFIG[range_]
    if unit == "day":
        prev_start = current_start - timedelta(days=buckets)
    else:
        prev_start = _add_months(current_start, -buckets)
    return prev_start, current_start


def delta_pct(current: float, previous: float) -> float | None:
    """None rather than 0 when there is no prior activity — "no basis for
    comparison" and "flat" are different claims and render differently."""
    if previous == 0:
        return 0.0 if current == 0 else None
    return round(((current - previous) / previous) * 100, 1)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


async def read_range_analytics(db: AsyncSession, range_: AnalyticsRange) -> RangeAnalytics:
    quotations = list((await db.execute(select(Quotation))).scalars().all())

    now = datetime.now(timezone.utc)
    starts = bucket_starts(range_, now)
    _, unit = RANGE_CONFIG[range_]
    window_from = starts[0]
    prev_from, prev_to = _previous_window(range_, now)

    labels = [_bucket_label(d, unit) for d in starts]
    revenue_trend = [TrendPoint(label=label, value=0) for label in labels]
    order_trend = [TrendPoint(label=label, value=0) for label in labels]
    quotation_trend = [TrendPoint(label=label, value=0) for label in labels]

    revenue = 0.0
    order_count = 0
    prev_revenue = 0.0
    prev_order_count = 0
    clients: set[str] = set()
    prev_clients: set[str] = set()

    # Revenue and order counts come from confirmed quotations, not the `orders`
    # table: that table was fed by the customer checkout flow, which no longer
    # exists, so nothing has written to it since and reading it reported zero
    # revenue against a business that was taking orders. A confirmed quotation
    # is what the Orders screen shows and what payment is recorded against, so
    # both screens now agree on what was sold.
    for quotation in quotations:
        confirmation = quotation.confirmation
        # Confirmed only: a "quoted" request carries a priced confirmation the
        # customer has not accepted, and booking that as revenue would report
        # sales the business has not made.
        if confirmation is None or quotation.status != "confirmed":
            continue
        ts = _as_utc(confirmation.issued_at)
        if ts is None:
            continue
        client = (quotation.customer_email or "").lower()

        if ts >= window_from:
            i = _bucket_index_for(ts, starts)
            if i >= 0:
                revenue_trend[i].value += confirmation.grand_total
                order_trend[i].value += 1
            revenue += confirmation.grand_total
            order_count += 1
            if client:
                clients.add(client)
        elif prev_from <= ts < prev_to:
            prev_revenue += confirmation.grand_total
            prev_order_count += 1
            if client:
                prev_clients.add(client)

    quotation_count = 0
    prev_quotation_count = 0
    for quotation in quotations:
        ts = _as_utc(quotation.submitted_at)
        if ts is None:
            continue
        email = (quotation.customer_email or "").lower()

        if ts >= window_from:
            i = _bucket_index_for(ts, starts)
            if i >= 0:
                quotation_trend[i].value += 1
            quotation_count += 1
            if email:
                clients.add(email)
        elif prev_from <= ts < prev_to:
            prev_quotation_count += 1
            if email:
                prev_clients.add(email)

    # Purged orders. Bucketed by confirmed_at, not deleted_at: the money was
    # booked when the order was confirmed, so charting it on the day someone
    # tidied up would put an old write-off in this month's column. A stub with
    # no confirmed_at was never a confirmed order and so was never revenue.
    deleted_trend = [TrendPoint(label=label, value=0) for label in labels]
    deleted_revenue = 0.0
    deleted_order_count = 0
    for stub in (await db.execute(select(DeletedOrder))).scalars().all():
        ts = _as_utc(stub.confirmed_at)
        if ts is None or ts < window_from:
            continue
        i = _bucket_index_for(ts, starts)
        if i >= 0:
            deleted_trend[i].value += stub.grand_total
        deleted_revenue += stub.grand_total
        deleted_order_count += 1

    return RangeAnalytics(
        range=range_,
        revenue=revenue,
        revenue_delta_pct=delta_pct(revenue, prev_revenue),
        deleted_revenue=round(deleted_revenue, 2),
        deleted_order_count=deleted_order_count,
        deleted_revenue_trend=deleted_trend,
        order_count=order_count,
        order_count_delta_pct=delta_pct(order_count, prev_order_count),
        quotation_count=quotation_count,
        quotation_count_delta_pct=delta_pct(quotation_count, prev_quotation_count),
        active_clients=len(clients),
        active_clients_delta_pct=delta_pct(len(clients), len(prev_clients)),
        revenue_trend=revenue_trend,
        order_trend=order_trend,
        quotation_trend=quotation_trend,
    )


async def read_payment_analytics(db: AsyncSession, range_: AnalyticsRange) -> PaymentAnalytics:
    """Money received and money still owed, across confirmed orders.

    Reads confirmations rather than the `orders` table, because a confirmed
    quotation is what the Orders screen shows and what payment is recorded
    against — the two screens must not disagree about what was collected.

    Received is bucketed by `payment_received_at`; an order paid today counts
    today even if it was issued months ago, which is what makes the totals
    match a bank statement. Pending is bucketed by `issued_at` instead, since
    unpaid money has no payment date — that turns the second series into a
    read on how long invoices have been outstanding.
    """
    quotations = list((await db.execute(select(Quotation))).scalars().all())

    now = datetime.now(timezone.utc)
    starts = bucket_starts(range_, now)
    _, unit = RANGE_CONFIG[range_]
    window_from = starts[0]
    prev_from, prev_to = _previous_window(range_, now)

    labels = [_bucket_label(d, unit) for d in starts]
    received_trend = [TrendPoint(label=label, value=0) for label in labels]
    pending_trend = [TrendPoint(label=label, value=0) for label in labels]

    received = 0.0
    received_count = 0
    prev_received = 0.0
    pending = 0.0
    pending_count = 0

    for quotation in quotations:
        confirmation = quotation.confirmation
        # Confirmed only, which is exactly what the Orders table lists. A
        # "quoted" request also has a confirmation attached — the priced offer
        # whose PDF was produced — but the customer has not accepted it, so it
        # is a proposal rather than money owed. Counting those made the panel
        # total exceed the sum of the rows on screen.
        if confirmation is None or quotation.status != "confirmed":
            continue

        # Both figures come from the invoices raised against the order, the
        # same source the Orders screen and the row's PAYMENT pill read. This
        # used to read confirmation.payment_status, a stored flag nothing has
        # written since payment became derived — so every row could show
        # RECEIVED while this panel reported zero collected.
        #
        # Deriving also lets a part-paid order be told the truth. The flag
        # was binary, so an order with 400 of 1000 paid put its whole value
        # on one side and nothing on the other.
        position = await ops.payment_position(db, quotation)
        pending += position["amount_outstanding"]
        if position["amount_outstanding"] > 0.005:
            pending_count += 1
        if position["amount_paid"] > 0.005:
            received_count += 1

        # Outstanding money is a running balance, not a windowed figure: an
        # invoice issued last year is still owed today, so the total counts
        # every unpaid order while only the chart is windowed.
        issued = _as_utc(confirmation.issued_at)
        if (
            position["amount_outstanding"] > 0.005
            and issued is not None
            and issued >= window_from
        ):
            i = _bucket_index_for(issued, starts)
            if i >= 0:
                pending_trend[i].value += position["amount_outstanding"]

        # Received is bucketed per receipt rather than per order, because a
        # receipt is what a bank statement records: two instalments in
        # different months belong in the months they arrived, not both in
        # whichever one the order happens to carry.
        for payment in await ops.payments_against(db, quotation):
            ts = _as_utc(payment.received_at)
            if ts is None:
                # No date recorded: the money is real, so it belongs in the
                # total even though it cannot be placed in a bucket.
                received += payment.amount
                continue
            if ts >= window_from:
                i = _bucket_index_for(ts, starts)
                if i >= 0:
                    received_trend[i].value += payment.amount
                received += payment.amount
            elif prev_from <= ts < prev_to:
                prev_received += payment.amount

    return PaymentAnalytics(
        range=range_,
        received=received,
        received_delta_pct=delta_pct(received, prev_received),
        received_count=received_count,
        pending=pending,
        pending_count=pending_count,
        received_trend=received_trend,
        pending_trend=pending_trend,
    )


async def order_status_ratio(db: AsyncSession) -> list[OrderRatioSlice]:
    """How every price request has resolved, for the conversion donut.

    Counts quotations rather than the `orders` table, which no longer has a
    writer. Everything short of confirmed or cancelled folds into "pending":
    an untouched request, a prepared quotation and one already sent are all
    still open as far as conversion is concerned.
    """
    quotations = list((await db.execute(select(Quotation))).scalars().all())
    counts: dict[str, int] = {"confirmed": 0, "pending": 0, "cancelled": 0}
    for quotation in quotations:
        if quotation.status in ("inbox", "pending", "submitted"):
            counts["pending"] += 1
        elif quotation.status in counts:
            counts[quotation.status] += 1
    return [OrderRatioSlice(status=s, count=c) for s, c in counts.items()]  # type: ignore[arg-type]


async def top_destinations(db: AsyncSession, limit: int = 6) -> list[CountryBreakdown]:
    """Where confirmed orders ship, from the country on each request.

    Confirmed only, matching the Orders screen: an unaccepted quote is not a
    destination the business has shipped to.
    """
    quotations = list((await db.execute(select(Quotation))).scalars().all())

    counts: dict[str, int] = defaultdict(int)
    for quotation in quotations:
        if quotation.status != "confirmed":
            continue
        country = ((quotation.details or {}).get("country") or "").strip()
        if country:
            # Group case and spacing variants so "bangladesh" and "Bangladesh"
            # are one destination rather than two.
            counts[country.title()] += 1

    ranked = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]
    return [CountryBreakdown(country=c, orders=n) for c, n in ranked]


async def low_stock(db: AsyncSession, threshold: int = 5, limit: int = 6) -> list[StockAlert]:
    """Products at or below the reorder threshold, scarcest first."""
    products = list(
        (
            await db.execute(
                select(Product)
                .where(Product.stock_qty <= threshold)
                .order_by(Product.stock_qty)
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return [
        StockAlert(part_number=p.part_number, name=p.name, slug=p.slug, quantity=p.stock_qty)
        for p in products
    ]


async def stock_status_breakdown(db: AsyncSession) -> StockStatusBreakdown:
    """The whole catalogue's stock position in one row.

    Counts are derived from stock_qty here rather than read from the stored
    `stock` column: that column is itself derived (see derive_stock_status),
    and counting the quantity directly means this panel cannot disagree with
    the Warehouse alerts panel beside it if a write ever leaves the two out
    of step.
    """
    products = list((await db.execute(select(Product))).scalars().all())

    in_stock = low = out = 0
    total_units = 0
    stock_value = 0.0
    for product in products:
        quantity = int(product.stock_qty or 0)
        total_units += quantity
        stock_value += quantity * float(product.price or 0.0)
        if quantity <= 0:
            out += 1
        elif quantity < 10:
            low += 1
        else:
            in_stock += 1

    return StockStatusBreakdown(
        in_stock=in_stock,
        low_stock=low,
        out_of_stock=out,
        total_units=total_units,
        stock_value=round(stock_value, 2),
    )


async def top_sellers(
    db: AsyncSession, period: str = "month", limit: int = 8
) -> list[TopSellerOut]:
    """Aggregates quantity sold per product from issued confirmations.

    Issued orders are the strongest sales signal available, and computing at
    query time means there is no stored rank column to drift out of sync.
    """
    now = datetime.now(timezone.utc)
    if period == "week":
        since = now - timedelta(days=7)
    elif period == "year":
        since = now - timedelta(days=365)
    else:
        since = now - timedelta(days=30)

    confirmations = list(
        (await db.execute(select(OrderConfirmation).where(OrderConfirmation.issued_at >= since)))
        .scalars()
        .all()
    )

    quantities: dict[str, int] = defaultdict(int)
    for confirmation in confirmations:
        for line in confirmation.lines or []:
            slug = (line or {}).get("slug")
            if not slug:
                continue
            try:
                quantities[slug] += int(line.get("quantity") or 0)
            except (TypeError, ValueError):
                continue

    if not quantities:
        return []

    ranked = sorted(quantities.items(), key=lambda kv: kv[1], reverse=True)[:limit]
    slugs = [slug for slug, _ in ranked]
    products = {
        p.slug: p
        for p in (await db.execute(select(Product).where(Product.slug.in_(slugs)))).scalars().all()
    }

    return [
        TopSellerOut(product=ProductOut.model_validate(products[slug]), quantity_sold=qty)
        for slug, qty in ranked
        if slug in products
    ]


async def nav_counts(db: AsyncSession, *, orders: bool, contact_requests: bool) -> NavCounts:
    """The five sidebar badge numbers, as counts rather than as lists.

    `orders` and `contact_requests` say whether this viewer reaches those
    areas at all; when they do not, the badge is zero and the query is not
    run, matching what the screens themselves would show them.

    Counted in SQL for the same reason the layout needed fixing: it renders
    on every navigation, and loading whole tables to call len() on them made
    every screen change wait on work no badge needed.
    """
    products = await db.scalar(select(func.count()).select_from(Product)) or 0
    low_stock_count = (
        await db.scalar(
            select(func.count()).select_from(Product).where(Product.stock != "in-stock")
        )
        or 0
    )

    pending_orders = 0
    pending_quotations = 0
    if orders:
        # An order is pending until its confirmation reaches the final stage.
        pending_orders = (
            await db.scalar(
                select(func.count())
                .select_from(Quotation)
                .join(OrderConfirmation, OrderConfirmation.quotation_id == Quotation.id)
                .where(
                    Quotation.status == "confirmed",
                    func.coalesce(OrderConfirmation.delivery_stage, 0) < ops.MAX_STAGE,
                )
            )
            or 0
        )
        # Every stage short of a decision is still work in hand.
        pending_quotations = (
            await db.scalar(
                select(func.count())
                .select_from(Quotation)
                .where(Quotation.status.in_(("inbox", "pending", "submitted")))
            )
            or 0
        )

    open_contact_requests = 0
    if contact_requests:
        open_contact_requests = (
            await db.scalar(
                select(func.count())
                .select_from(ContactRequest)
                .where(ContactRequest.handled.is_(False))
            )
            or 0
        )

    return NavCounts(
        products=int(products),
        low_stock=int(low_stock_count),
        pending_orders=int(pending_orders),
        pending_quotations=int(pending_quotations),
        open_contact_requests=int(open_contact_requests),
    )
