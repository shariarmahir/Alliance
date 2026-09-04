"""The Chittagong Stock Exchange's market summary, for the admin Overview.

CSE publishes no API, so this reads its public homepage. Three things come
from it:

  * the index summary and intraday chart, from two POST endpoints the page's
    own JavaScript calls (`load__index_summary` and `graph_load`). Both
    require a CSRF token that is minted per session and embedded in the page,
    so a scrape is always: fetch the page, read the token, post with the
    cookie it set.

  * Today's Top 10 -- gainers, losers, volume and value -- and the market
    statistics strip, which are server-rendered into the HTML itself.

Everything is cached in `market_series`. The scrape costs three requests and
the numbers only move during trading hours, so refetching per page load would
hammer someone else's server for data that has not changed. A failed scrape
leaves the last good snapshot in place: a stale market figure clearly labelled
with its time is worth more than an empty panel, and must never take the
Overview's own revenue figures down with it.

Parsing is deliberately defensive. This is someone else's markup and it will
change without warning; every extractor returns empty rather than raising, so
a redesign at CSE degrades this panel instead of breaking the dashboard.
"""

import asyncio
import logging
import re
import ssl
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import MarketSeries

logger = logging.getLogger("app.market")

CSE_BASE = "https://www.cse.com.bd"

# The indices CSE's own dropdown offers, in its order.
INDICES = ["CSE50", "CSE30", "CSCX", "CASPI", "CSI"]
DEFAULT_INDEX = "CSE50"

# The four Top 10 tabs, in the order their content_N divs appear.
TOP_TABS = ["gainers", "losers", "volume", "value"]

# A browser UA: the site serves a different (or no) page to obvious scripts.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

_TOKEN_RE = re.compile(r"csrf_cse_token:\s*'([0-9a-f]+)'")
_TAG_RE = re.compile(r"<[^>]+>")

# CSE serves an incomplete certificate chain -- the leaf only, without the
# GlobalSign intermediate that signs it -- so a strict client cannot build a
# path to a trusted root and every request fails verification. Browsers and
# curl fetch the missing link themselves; httpx does not. Supplying the
# intermediate alongside certifi's roots completes the chain with
# verification fully on, which is the point: the usual shortcut for this
# error is verify=False, and that would accept any certificate at all for a
# host we do not control. See app/integrations/certs/README.md.
_EXTRA_CA = (
    Path(__file__).resolve().parent.parent
    / "integrations"
    / "certs"
    / "globalsign-gcc-r3-dv-tls-ca-2020.pem"
)


@lru_cache(maxsize=1)
def _ssl_context() -> ssl.SSLContext:
    import certifi

    context = ssl.create_default_context(cafile=certifi.where())
    if _EXTRA_CA.exists():
        context.load_verify_locations(cafile=str(_EXTRA_CA))
    return context


def _text(fragment: str) -> str:
    """Tag-stripped, entity-decoded, whitespace-collapsed text."""
    import html

    return re.sub(r"\s+", " ", html.unescape(_TAG_RE.sub(" ", fragment))).strip()


def _number(value: str) -> float:
    """A figure from the page as a float, or 0.0 when it is not one.

    CSE prints thousands separators and the occasional stray symbol, and an
    unparseable cell must not abort a whole table.
    """
    cleaned = re.sub(r"[^0-9.\-]", "", value or "")
    if not cleaned or cleaned in {"-", ".", "-."}:
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _parse_top_tables(html: str) -> dict[str, dict]:
    """The four Top 10 tables, keyed by tab name.

    Each is `{columns: [...], rows: [[...]]}`. The columns are read from the
    table's own header rather than assumed, because the four tabs do not
    share a shape: Gainers and Losers report Company/LTP/Change/Change %,
    while Volume and Value report Company/YCP/LTP/Volume or Value (mn).
    Hard-coding the gainers' columns for all four would have labelled a share
    volume of 424,699 as a 424,699% price move.

    Values stay as text. These are display-only figures with CSE's own
    formatting -- 2 decimal places on a price, none on a volume -- and
    parsing them to floats only to format them again would be a chance to
    render 35.90 as 35.9.
    """
    tables: dict[str, dict] = {}
    for i, tab in enumerate(TOP_TABS, start=1):
        # Anchored on the tap_content div, which is the only unambiguous
        # marker for a tab. The bare id cannot be used: the tab-switch script
        # above the markup mentions content_1 in a usage comment, so a plain
        # id search finds the comment. Nor can the inner container -- CSE
        # gives every one of the four tabs id="mitabs-1", which is invalid
        # HTML but is what they serve.
        marker = f'<div id="content_{i}" class="tap_content">'
        start = html.find(marker)
        if start == -1:
            tables[tab] = {"columns": [], "rows": []}
            continue
        end = html.find(f'<div id="content_{i + 1}" class="tap_content">', start)
        block = html[start : end if end != -1 else start + 20000]

        rows: list[dict] = []
        # Cells are matched directly rather than by first splitting on a row
        # wrapper: CSE's rows close with irregular whitespace and stray tabs,
        # and grouping every four ColN cells is both simpler and unaffected
        # by how the surrounding divs happen to be indented.
        # \s+ before class, not a single space: CSE emits `<div  class="Col1">`
        # with a double space on some rows, which a literal space misses --
        # and a missed Col1 silently shifts every value in that row.
        columns = [
            _text(header)
            for header in re.findall(
                r'<div\s+class="Col[1-4]"><span>(.*?)</span></div>', block, re.S
            )
        ][:4]

        cells = re.findall(r'<div\s+class="Col([1-4])">(.*?)</div>', block, re.S)
        current: dict[str, str] = {}
        for column, value in cells:
            current[column] = _text(value)
            if column != "4":
                continue
            first = current.get("1", "")
            # The header row carries the same ColN classes as the data rows,
            # so it is skipped by its own label rather than by position: a
            # change of row order upstream cannot then start admitting it.
            if first and first.lower() != "company":
                rows.append([current.get(str(n), "") for n in range(1, 5)])
            current = {}
        tables[tab] = {"columns": columns, "rows": rows[:10]}
    return tables


def _parse_statistics(html: str) -> dict:
    """The trade summary strip beneath the chart.

    Each figure is a caption/value pair; Issues Traded carries four numbers
    (total, advanced, declined, unchanged) inside one value, coloured rather
    than separately labelled, so it is split out by position.
    """
    stats: dict[str, object] = {}
    pairs = re.findall(
        r'<div class="caption1"><p>(.*?)</p></div>\s*'
        r'<div style="float:left;" class="value1"><p>(.*?)</p></div>',
        html,
        re.S,
    )
    if not pairs:
        pairs = re.findall(
            r'class="caption1"><p>(.*?)</p>.*?class="value1"><p>(.*?)</p>', html, re.S
        )

    for caption_raw, value_raw in pairs:
        caption = _text(caption_raw).rstrip(".").lower()
        value = _text(value_raw)
        if caption.startswith("issues traded"):
            numbers = [int(n.replace(",", "")) for n in re.findall(r"[\d,]+", value)]
            stats["issuesTraded"] = numbers[0] if numbers else 0
            stats["advanced"] = numbers[1] if len(numbers) > 1 else 0
            stats["declined"] = numbers[2] if len(numbers) > 2 else 0
            stats["unchanged"] = numbers[3] if len(numbers) > 3 else 0
        elif caption.startswith("volume"):
            stats["volume"] = _number(value)
        elif caption.startswith("issued cap"):
            stats["issuedCap"] = _number(value)
        elif caption.startswith("value in taka"):
            stats["valueInTaka"] = _number(value)
        elif caption.startswith("contract"):
            stats["contractNumber"] = _number(value)
        elif caption.startswith("closing market cap"):
            stats["marketCap"] = _number(value)
    return stats


def _to_minutes(hhmmss: str) -> str:
    """"09:16:00" as "09:16" — the chart's axis labels are to the minute."""
    parts = (hhmmss or "").split(":")
    return f"{parts[0]}:{parts[1]}" if len(parts) >= 2 else (hhmmss or "")


async def _scrape(index: str) -> dict | None:
    """One full snapshot of CSE, or None if it could not be read."""
    import httpx

    async with httpx.AsyncClient(
        timeout=25.0, headers=_HEADERS, follow_redirects=True, verify=_ssl_context()
    ) as client:
        page = await client.get(f"{CSE_BASE}/")
        page.raise_for_status()
        html = page.text

        token_match = _TOKEN_RE.search(html)
        if not token_match:
            # The page loaded but not as expected — most likely a redesign or
            # an interstitial. Nothing here is trustworthy, so take none of it.
            logger.warning("No CSRF token in the CSE page; skipping this refresh.")
            return None
        token = token_match.group(1)
        form = {"selected_index": index, "csrf_cse_token": token}

        summary: dict = {}
        points: list[dict] = []
        try:
            response = await client.post(f"{CSE_BASE}/home/load__index_summary/", data=form)
            response.raise_for_status()
            summary = response.json()
        except Exception:
            logger.exception("Could not read the CSE index summary for %s", index)

        try:
            response = await client.post(f"{CSE_BASE}/home/graph_load/", data=form)
            response.raise_for_status()
            points = [
                {"label": _to_minutes(row.get("idx_time", "")), "value": _number(row.get("idx_capital_value", ""))}
                for row in response.json()
                if row.get("idx_time")
            ]
        except Exception:
            logger.exception("Could not read the CSE index graph for %s", index)

    return {
        "index": index,
        "value": _number(str(summary.get("value", ""))),
        "change": _number(str(summary.get("change", ""))),
        "changePct": _number(str(summary.get("percentage_change", ""))),
        "points": points,
        "top": _parse_top_tables(html),
        "stats": _parse_statistics(html),
    }


# Indices with a background refresh already in flight. Without this, every
# request arriving during a ~2s scrape would start another one, so a busy
# dashboard would hit CSE dozens of times for a single expiry.
_refreshing: set[str] = set()


def _schedule_background_refresh(index: str) -> None:
    """Refreshes one index out of band, at most one scrape per index at a time.

    Fire-and-forget on purpose: the caller has already answered from cache,
    so nothing depends on the result and a failure here must stay invisible
    to the request that triggered it.
    """
    if index in _refreshing:
        return

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return

    _refreshing.add(index)

    async def _run() -> None:
        try:
            # A session of its own: the request's is closed the moment its
            # response is sent, and reusing it here would fail once this
            # outlives that request -- which is the entire point.
            from app.db import async_session_factory

            async with async_session_factory() as session:
                await get_market_snapshot(session, index, force=True)
        except Exception:
            logger.exception("Background market refresh failed for %s", index)
        finally:
            _refreshing.discard(index)

    loop.create_task(_run())


def _is_stale(fetched_at: datetime | None) -> bool:
    if fetched_at is None:
        return True
    return datetime.now(timezone.utc) - fetched_at > timedelta(
        minutes=settings.market_cache_minutes
    )


async def get_market_snapshot(
    db: AsyncSession, index: str = DEFAULT_INDEX, *, force: bool = False
) -> MarketSeries | None:
    """The cached CSE snapshot for one index, refreshed when stale.

    Stale-while-revalidate: an expired snapshot is still returned immediately
    and refreshed in the background. Only the very first request for an index
    -- when there is nothing cached at all -- waits for the scrape.

    That distinction matters because the scrape takes over two seconds: with
    a blocking refresh, one admin every cache window paid that cost on a
    dashboard whose own figures were already in hand, and the whole Overview
    sat blank until a third party's website replied.
    """
    if index not in INDICES:
        index = DEFAULT_INDEX

    row = await db.get(MarketSeries, index)
    if row is not None and not force and not _is_stale(row.fetched_at):
        return row

    if row is not None and not force:
        # Something usable is cached. Hand it over now and bring it up to
        # date out of band, so nobody waits on CSE for figures that are at
        # most one cache window old.
        _schedule_background_refresh(index)
        return row

    try:
        scraped = await _scrape(index)
    except Exception:
        logger.exception("Could not reach CSE for %s", index)
        return row

    gainers = (scraped or {}).get("top", {}).get("gainers", {}).get("rows") or []
    if scraped is None or (not scraped["points"] and not gainers):
        # Nothing usable came back. Keep whatever is cached rather than
        # overwriting real figures with an empty snapshot.
        return row

    if row is None:
        row = MarketSeries(index=index)
        db.add(row)

    row.value = scraped["value"]
    row.change = scraped["change"]
    row.change_pct = scraped["changePct"]
    row.points = scraped["points"]
    row.top = scraped["top"]
    row.stats = scraped["stats"]
    row.fetched_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(row)
    return row


async def list_cached_indices(db: AsyncSession) -> list[MarketSeries]:
    return list((await db.execute(select(MarketSeries))).scalars().all())
