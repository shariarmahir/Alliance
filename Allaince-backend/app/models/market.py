from datetime import datetime

from sqlalchemy import Float, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, JSONVariant, UTCDateTime, utcnow


class MarketSeries(Base):
    """A cached snapshot of one CSE index.

    Cached rather than fetched per request because this is scraped from
    someone else's public site: the numbers only move during trading hours,
    and refetching on every Overview load would mean three requests to CSE
    per page view for data that has not changed.

    The nested shapes stay JSON. `points` is an intraday series, `top` is
    four ranked tables and `stats` a handful of headline figures — nothing
    queries inside them, the panel always reads a whole snapshot, and keeping
    them opaque means a change to what CSE publishes needs no migration.
    """

    __tablename__ = "market_series"

    # The index code, e.g. "CSE50" — one row per index, overwritten in place.
    index: Mapped[str] = mapped_column(String(20), primary_key=True)
    value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    change: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    change_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    # [{label: "09:16", value: 1094.13}, ...] through the trading day.
    points: Mapped[list] = mapped_column(JSONVariant, default=list, nullable=False)
    # {gainers: [...], losers: [...], volume: [...], value: [...]}
    top: Mapped[dict] = mapped_column(JSONVariant, default=dict, nullable=False)
    # Issues traded, volume, turnover, market cap and so on.
    stats: Mapped[dict] = mapped_column(JSONVariant, default=dict, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)
