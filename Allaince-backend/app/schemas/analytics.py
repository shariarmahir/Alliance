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


class MarketTable(CamelModel):
    """One Top 10 tab: its own column headers, and rows of matching cells.

    Generic rather than a fixed set of named fields because the four tabs do
    not share a shape -- Gainers reports Change %, Volume reports a share
    count -- and cells stay strings so CSE's own formatting survives to the
    screen.
    """

    columns: list[str] = []
    rows: list[list[str]] = []


class MarketPoint(CamelModel):
    label: str  # "09:16"
    value: float


class MarketStats(CamelModel):
    """The trade summary strip. Every field defaults, because these are
    scraped and CSE may not publish all of them on a given day."""

    issues_traded: int = 0
    advanced: int = 0
    declined: int = 0
    unchanged: int = 0
    volume: float = 0
    issued_cap: float = 0
    value_in_taka: float = 0
    contract_number: float = 0
    market_cap: float = 0


class MarketSnapshot(CamelModel):
    index: str
    indices: list[str]
    value: float
    change: float
    change_pct: float
    points: list[MarketPoint]
    top: dict[str, MarketTable]
    stats: MarketStats
    fetched_at: datetime | None = None


class StockStatusBreakdown(CamelModel):
    """The catalogue's own stock position, for the panel beside the market
    chart: how many products sit in each state and what they are worth."""

    in_stock: int
    low_stock: int
    out_of_stock: int
    total_units: int
    stock_value: float


class NavCounts(CamelModel):
    """The sidebar badge numbers, counted in the database.

    The admin layout renders on every navigation, so these were previously
    paid for by listing every product, quotation and contact request in full
    -- and each quotation then had its delivery and payment position derived
    with three more queries apiece. Counting is what the badges actually
    need, so it is done as counts.
    """

    products: int
    low_stock: int
    pending_orders: int
    pending_quotations: int
    open_contact_requests: int


class SearchResult(CamelModel):
    type: SearchResultType
    id: str
    title: str
    subtitle: str
    href: str
