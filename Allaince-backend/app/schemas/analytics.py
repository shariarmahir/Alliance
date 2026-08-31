from datetime import datetime
from typing import Literal

from app.schemas.session import CamelModel

AnalyticsRange = Literal["week", "month", "year"]
SearchResultType = Literal["order", "quotation", "product", "client"]


class TrendPoint(CamelModel):
    label: str
    value: float


class RangeAnalytics(CamelModel):
    range: AnalyticsRange
    revenue: float
    revenue_delta_pct: float | None
    order_count: int
    order_count_delta_pct: float | None
    quotation_count: int
    quotation_count_delta_pct: float | None
    active_clients: int
    active_clients_delta_pct: float | None
    revenue_trend: list[TrendPoint]
    order_trend: list[TrendPoint]
    quotation_trend: list[TrendPoint]
    # Orders destroyed by "Remove anyway", charted against the period they
    # were confirmed in rather than the day they were deleted -- otherwise a
    # cleanup of old records would show as a spike in the current month.
    # Separate from revenue_trend because these are not sales: revenue counts
    # live confirmed orders, so a purged order has already left that series.
    # Showing them together would net a deletion against real income.
    deleted_revenue: float = 0.0
    deleted_order_count: int = 0
    deleted_revenue_trend: list[TrendPoint] = []


class PaymentAnalytics(CamelModel):
    """Money in and money owed, over one range.

    Received is bucketed by when payment was recorded; pending is bucketed by
    when the unpaid order was issued, which is what makes the outstanding
    figure readable as aging rather than as a second income line.
    """

    range: AnalyticsRange
    received: float
    received_delta_pct: float | None
    received_count: int
    pending: float
    pending_count: int
    received_trend: list[TrendPoint]
    pending_trend: list[TrendPoint]


class OrderRatioSlice(CamelModel):
    status: Literal["confirmed", "pending", "cancelled"]
    count: int


class CountryBreakdown(CamelModel):
    country: str
    orders: int


class StockAlert(CamelModel):
    part_number: str
    name: str
    slug: str
    quantity: int


class MarketBar(CamelModel):
    """One week of trading, as the provider reports it."""

    t: int  # epoch milliseconds at the start of the week
    o: float
    h: float
    l: float
    c: float
    v: float


class MarketSeriesOut(CamelModel):
    ticker: str
    label: str
    bars: list[MarketBar]
    latest_close: float
    change_pct: float
    week_volume: int
    fetched_at: datetime | None = None


class StockStatusBreakdown(CamelModel):
    """The catalogue's own stock position, for the panel beside the market
    chart: how many products sit in each state and what they are worth."""

    in_stock: int
    low_stock: int
    out_of_stock: int
    total_units: int
    stock_value: float


class SearchResult(CamelModel):
    type: SearchResultType
    id: str
    title: str
    subtitle: str
    href: str
