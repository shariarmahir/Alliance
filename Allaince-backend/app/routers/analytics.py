from fastapi import APIRouter, Depends, Query

from app.core.deps import AdminDep, DbSession, SuperAdminDep, require_area
from app.schemas.analytics import (
    AnalyticsRange,
    CountryBreakdown,
    OrderRatioSlice,
    PaymentAnalytics,
    RangeAnalytics,
    SearchResult,
    StockAlert,
)
from app.services.analytics import (
    low_stock,
    order_status_ratio,
    read_payment_analytics,
    read_range_analytics,
    top_destinations,
)
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


@router.get("/search", response_model=list[SearchResult])
async def search(session: AdminDep, db: DbSession, q: str = ""):
    """Results are scoped to the caller's grants, so a sub-admin never sees a
    record they would be blocked from opening."""
    return await search_admin(db, q, session)
