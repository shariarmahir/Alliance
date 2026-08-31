from datetime import datetime

from sqlalchemy import Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, JSONVariant, UTCDateTime, utcnow


class MarketSeries(Base):
    """A cached weekly price series for one ticker.

    Stored rather than fetched per request because the provider's free tier
    allows five requests a minute: the Overview would exhaust that on a single
    reload with a handful of tickers, and every admin viewing the page would
    compete for the same quota. One row per ticker, refreshed at most once
    every settings.market_cache_hours, keeps the panel instant and the API
    usage flat no matter how often the page is opened.

    `bars` holds the provider's weekly aggregates as a JSON list of
    {t, o, h, l, c, v} — the shape it returns — so a change of chart or a new
    derived figure needs no migration and no refetch.
    """

    __tablename__ = "market_series"

    ticker: Mapped[str] = mapped_column(String(20), primary_key=True)
    # The manufacturer as this business knows it, not the issuer's legal name:
    # the panel sits beside a catalogue of Siemens and Omron parts.
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    bars: Mapped[list] = mapped_column(JSONVariant, default=list, nullable=False)
    # Denormalised from the last two bars so the panel can rank and colour
    # without re-deriving it on every read.
    latest_close: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    change_pct: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    week_volume: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, nullable=False)
