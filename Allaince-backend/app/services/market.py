"""Weekly share prices for the manufacturers whose parts this business trades.

Sourced from Massive (formerly Polygon.io). Two constraints shape everything
here:

  * The free tier allows five requests a minute. Every ticker is one request,
    so the series are cached in `market_series` and refreshed at most once
    every settings.market_cache_hours. The Overview reads the cache; it never
    waits on the provider.

  * The provider covers US listings only. Siemens, Omron, Mitsubishi Electric
    and Schneider are listed in Frankfurt, Tokyo and Paris, and those symbols
    return nothing at all -- so the US ADRs are tracked instead. They follow
    the same companies, priced in USD.

A ticker that returns no data is skipped rather than stored empty: the panel
shows the manufacturers it could price and says so, which is honest, where a
flat zero line would read as a company whose shares are worthless.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import MarketSeries

logger = logging.getLogger("app.market")

# The manufacturers this catalogue actually carries, as ADRs. Ordered the way
# the panel lists them when every series is equal.
TRACKED: list[tuple[str, str]] = [
    ("SIEGY", "Siemens"),
    ("MIELY", "Mitsubishi Electric"),
    ("OMRNY", "Omron"),
    ("SBGSY", "Schneider Electric"),
    ("ROK", "Rockwell / Allen-Bradley"),
]

# Enough weeks to read a trend without crowding a panel-sized chart.
WEEKS = 12

# How far back to ask. Deliberately far more than WEEKS: the free tier's data
# runs months behind the calendar, so a window of only the last twelve weeks
# can come back empty. The most recent WEEKS bars are kept from whatever the
# plan returns.
LOOKBACK_DAYS = 730

# The free tier's ceiling is 5 requests/minute. Tickers are fetched in series
# with a gap rather than concurrently: a refresh that trips the limit returns
# errors for the tail of the list, which would cache some manufacturers and
# silently drop the rest.
_REQUEST_GAP_SECONDS = 13.0


def _is_stale(fetched_at: datetime | None) -> bool:
    if fetched_at is None:
        return True
    age = datetime.now(timezone.utc) - fetched_at
    return age > timedelta(hours=settings.market_cache_hours)


async def _fetch_bars(client, ticker: str) -> list[dict]:
    """One ticker's most recent weekly aggregates, or [] if there are none.

    The window reaches back a long way on purpose. How current the data is
    depends on the plan -- the free tier runs some months behind -- so asking
    only for the last twelve weeks of the calendar can return two or three
    bars, or none at all. Asking for a wide range and keeping the tail gives
    a full chart of the most recent weeks the plan actually covers, whenever
    those happen to be.
    """
    today = date.today()
    start = today - timedelta(days=LOOKBACK_DAYS)
    url = (
        f"{settings.massive_base_url.rstrip('/')}"
        f"/v2/aggs/ticker/{ticker}/range/1/week/{start.isoformat()}/{today.isoformat()}"
    )
    response = await client.get(
        url,
        params={
            "adjusted": "true",
            "sort": "asc",
            # The provider truncates to `limit` from the START of the range,
            # so this has to cover the whole window; the tail is sliced off
            # below. Limiting to WEEKS here returns the OLDEST weeks instead.
            "limit": 5000,
            "apiKey": settings.massive_api_key,
        },
    )
    response.raise_for_status()
    payload = response.json()

    if payload.get("status") == "ERROR":
        # Rate limit and entitlement problems arrive as 200s with an error
        # body, so status has to be read rather than relying on the HTTP code.
        raise RuntimeError(payload.get("error") or "Market provider returned an error.")

    results = payload.get("results") or []
    return [
        {
            "t": bar.get("t"),
            "o": bar.get("o"),
            "h": bar.get("h"),
            "l": bar.get("l"),
            "c": bar.get("c"),
            "v": bar.get("v"),
        }
        for bar in results
        if bar.get("c") is not None and bar.get("t") is not None
    ][-WEEKS:]


def _summarise(bars: list[dict]) -> tuple[float, float, int]:
    """Latest close, week-on-week change, and the latest week's volume."""
    if not bars:
        return 0.0, 0.0, 0
    latest = float(bars[-1].get("c") or 0.0)
    previous = float(bars[-2].get("c") or 0.0) if len(bars) > 1 else 0.0
    change = round(((latest - previous) / previous) * 100, 2) if previous else 0.0
    return round(latest, 2), change, int(bars[-1].get("v") or 0)


async def refresh_market_series(db: AsyncSession, *, force: bool = False) -> list[MarketSeries]:
    """Brings the cache up to date and returns every stored series.

    A provider failure is logged and swallowed: this is a panel on a
    dashboard, and a market API being down must not take the Overview -- or
    the revenue figures beside it -- with it. The last good series stays on
    screen, which is what a stale price should do.
    """
    stored = {row.ticker: row for row in await list_market_series(db)}

    if not settings.massive_api_key:
        return list(stored.values())

    due = [
        (ticker, label)
        for ticker, label in TRACKED
        if force or _is_stale(stored.get(ticker).fetched_at if stored.get(ticker) else None)
    ]
    if not due:
        return list(stored.values())

    import httpx

    changed = False
    async with httpx.AsyncClient(timeout=20.0) as client:
        for index, (ticker, label) in enumerate(due):
            if index:
                await asyncio.sleep(_REQUEST_GAP_SECONDS)
            try:
                bars = await _fetch_bars(client, ticker)
            except Exception:
                logger.exception("Could not refresh market series for %s", ticker)
                continue

            if not bars:
                # Nothing to show for this symbol on this plan; leave whatever
                # is cached rather than replacing real prices with an empty row.
                logger.info("Market provider returned no bars for %s", ticker)
                continue

            latest_close, change_pct, week_volume = _summarise(bars)
            row = stored.get(ticker)
            if row is None:
                row = MarketSeries(ticker=ticker, label=label)
                db.add(row)
                stored[ticker] = row
            row.label = label
            row.bars = bars
            row.latest_close = latest_close
            row.change_pct = change_pct
            row.week_volume = week_volume
            row.fetched_at = datetime.now(timezone.utc)
            changed = True

    if changed:
        await db.commit()
    return await list_market_series(db)


async def list_market_series(db: AsyncSession) -> list[MarketSeries]:
    rows = list((await db.execute(select(MarketSeries))).scalars().all())
    # Ordered by TRACKED so the panel's rows keep a stable position between
    # refreshes instead of reshuffling with whatever the database returns.
    order = {ticker: i for i, (ticker, _) in enumerate(TRACKED)}
    rows.sort(key=lambda r: order.get(r.ticker, len(order)))
    return rows
