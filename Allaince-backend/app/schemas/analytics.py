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


class SearchResult(CamelModel):
    type: SearchResultType
    id: str
    title: str
    subtitle: str
    href: str
