from fastapi import APIRouter, Depends, Query

from app.core.deps import AdminDep, DbSession, SuperAdminDep, holds_area, require_area
from app.schemas.analytics import (
    AnalyticsRange,
    CountryBreakdown,
    NavCounts,
    OrderRatioSlice,
    PaymentAnalytics,
    RangeAnalytics,
    MarketSnapshot,
    SearchResult,
    StockAlert,
    StockStatusBreakdown,
)
from app.services.analytics import (
    low_stock,
    nav_counts,
    order_status_ratio,
    stock_status_breakdown,
    read_payment_analytics,
    read_range_analytics,
    top_destinations,
)
from app.services.market import INDICES, get_market_snapshot
from app.services.search import search_admin

router = APIRouter(prefix="/api/admin", tags=["analytics"])


@router.get("/analytics", response_model=RangeAnalytics)
async def analytics(
    session: SuperAdminDep,
    db: DbSession,
    range: AnalyticsRange = Query("month"),
):
    """Business-wide figures — super admin only."""
    return await read_range_analytics(db, range)


@router.get("/analytics/payments", response_model=PaymentAnalytics)
async def payment_analytics(
    db: DbSession,
    session=Depends(require_area("orders")),
    range: AnalyticsRange = Query("month"),
):
    """Payments received and outstanding, for the Orders screen.

    Gated on the orders grant rather than super-admin: this is the same money
    already visible as a per-row payment status to anyone who can work that
    screen, so requiring super here would hide totals from the staff who
    record them.
    """
    return await read_payment_analytics(db, range)


@router.get("/analytics/nav-counts", response_model=NavCounts)
async def nav_badge_counts(session: AdminDep, db: DbSession):
    """The sidebar badge numbers for whoever is asking.

    Open to any admin because every admin has a sidebar; the areas they
    cannot reach come back as zero rather than being counted, so this never
    reports totals from a screen the caller is not allowed to open.
    """
    return await nav_counts(
        db,
        orders=holds_area(session, "orders") or holds_area(session, "quotations"),
        contact_requests=holds_area(session, "contact-requests"),
    )


@router.get("/analytics/order-ratio", response_model=list[OrderRatioSlice])
async def order_ratio(session: SuperAdminDep, db: DbSession):
    return await order_status_ratio(db)


@router.get("/analytics/destinations", response_model=list[CountryBreakdown])
async def destinations(session: SuperAdminDep, db: DbSession):
    return await top_destinations(db)


@router.get("/analytics/low-stock", response_model=list[StockAlert])
async def stock_alerts(session: AdminDep, db: DbSession, threshold: int = Query(5, ge=0)):
    """Open to any admin: stock is already visible to every sub-admin on the
    stock screen, so gating the same numbers here would only hide them from
    the staff who act on them."""
    return await low_stock(db, threshold=threshold)


@router.get("/analytics/stock-status", response_model=StockStatusBreakdown)
async def stock_status(session: AdminDep, db: DbSession):
    """The catalogue's overall stock position, beside the market panel.

    Open to any admin on the same reasoning as low-stock alerts: these are
    the numbers the stock screen already shows every sub-admin.
    """
    return await stock_status_breakdown(db)


@router.get("/analytics/market", response_model=MarketSnapshot)
async def market(
    session: SuperAdminDep,
    db: DbSession,
    index: str = Query("CSE50"),
):
    """The CSE market summary shown on the Overview.

    Served from the cache and refreshed on a timer -- this is scraped from
    CSE's public site, so a fetch per page load would mean hammering someone
    else's server for figures that only move during trading hours.

    An unreachable CSE returns the empty snapshot rather than an error: the
    market panel is context beside the business's own numbers, and it must
    not be able to take the Overview down with it.
    """
    row = await get_market_snapshot(db, index)
    if row is None:
        return MarketSnapshot(
            index=index if index in INDICES else "CSE50",
            indices=INDICES,
            value=0, change=0, change_pct=0,
            points=[], top={}, stats={},
        )
    return MarketSnapshot(
        index=row.index,
        indices=INDICES,
        value=row.value,
        change=row.change,
        change_pct=row.change_pct,
        points=row.points or [],
        top=row.top or {},
        stats=row.stats or {},
        fetched_at=row.fetched_at,
    )


@router.get("/search", response_model=list[SearchResult])
async def search(session: AdminDep, db: DbSession, q: str = ""):
    """Results are scoped to the caller's grants, so a sub-admin never sees a
    record they would be blocked from opening."""
    return await search_admin(db, q, session)
