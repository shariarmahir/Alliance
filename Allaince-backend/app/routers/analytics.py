from fastapi import APIRouter, Query

from app.core.deps import AdminDep, DbSession, SuperAdminDep
from app.schemas.analytics import (
    AnalyticsRange,
    OrderRatioSlice,
    RangeAnalytics,
    SearchResult,
)
from app.services.analytics import order_status_ratio, read_range_analytics
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


@router.get("/analytics/order-ratio", response_model=list[OrderRatioSlice])
async def order_ratio(session: SuperAdminDep, db: DbSession):
    return await order_status_ratio(db)


@router.get("/search", response_model=list[SearchResult])
async def search(session: AdminDep, db: DbSession, q: str = ""):
    """Results are scoped to the caller's grants, so a sub-admin never sees a
    record they would be blocked from opening."""
    return await search_admin(db, q, session)
