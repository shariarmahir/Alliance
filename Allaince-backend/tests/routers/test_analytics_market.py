"""The Overview's CSE market panel and the stock-position figures beside it.

The market data is scraped from a third party's public site, so the things
worth pinning down are the ones that keep a dashboard standing when that site
misbehaves: an outage, a redesign, and a cache that stops the Overview
hammering someone else's server once per page load.

The parsers are tested against a fixture cut down from CSE's real markup,
including its quirks -- every tab carrying id="mitabs-1", the double space in
`<div  class="Col1">` -- because those are exactly what a naive regex gets
wrong.
"""

from datetime import datetime, timedelta, timezone

from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.models import Category, Employee, MarketSeries, Product
from app.schemas.session import AdminSession
from app.services import market as market_svc


def _auth(client, role="super", **kwargs):
    client.cookies.set(
        ADMIN_SESSION_COOKIE,
        create_session_token(AdminSession(role=role, name="A", email="a@x.com", **kwargs)),
    )


# Trimmed from the live page, keeping the shapes that break naive parsing:
# the tab-switch script that mentions content_1 in a comment, the repeated
# mitabs-1 id, and the stray double space before class on some cells.
CSE_FIXTURE = """
<script>
// Usage: tabswitch(1, 4, 'tab', 'panel') would switch on tab_1 and panel_1
function tabSwitch_2(active, number, tab_prefix, content_prefix) {}
</script>
<div id="content_1" class="tap_content">
  <div id="mitabs-1">
    <div class="MIrow">
      <div class="Col1"><span>Company</span></div>
      <div class="Col2"><span>LTP</span></div>
      <div class="Col3"><span>Change</span></div>
      <div class="Col4"><span>Change %</span></div>
    </div>
    <div class="MIrow1">
      <div class="Col1"><a class="customHref" href="/x">SAIHAMTEX</a></div>
      <div class="Col2">35.90</div>
      <div class="Col3">3.00</div>
      <div class="Col4">9.12</div>
    </div>
  </div>
</div>
<div id="content_2" class="tap_content">
  <div id="mitabs-1">
    <div class="MIrow">
      <div class="Col1"><span>Company</span></div>
      <div class="Col2"><span>LTP</span></div>
      <div class="Col3"><span>Change</span></div>
      <div class="Col4"><span>Change %</span></div>
    </div>
    <div class="MIrow1">
      <div  class="Col1"><a class="customHref" href="/x">HRTEX</a></div>
      <div class="Col2">19.90</div>
      <div class="Col3">-2.20</div>
      <div class="Col4">-9.95</div>
    </div>
  </div>
</div>
<div id="content_3" class="tap_content">
  <div id="mitabs-1">
    <div class="MIrow">
      <div class="Col1"><span>Company</span></div>
      <div class="Col2"><span>YCP</span></div>
      <div class="Col3"><span>LTP</span></div>
      <div class="Col4"><span>Volume</span></div>
    </div>
    <div class="MIrow1">
      <div class="Col1"><a class="customHref" href="/x">PTL</a></div>
      <div class="Col2">69.40</div>
      <div class="Col3">71.40</div>
      <div class="Col4">424699</div>
    </div>
  </div>
</div>
<div id="content_4" class="tap_content">
  <div id="mitabs-1">
    <div class="MIrow">
      <div class="Col1"><span>Company</span></div>
      <div class="Col2"><span>YCP</span></div>
      <div class="Col3"><span>LTP</span></div>
      <div class="Col4"><span>Value (mn)</span></div>
    </div>
    <div class="MIrow1">
      <div class="Col1"><a class="customHref" href="/x">CITYGENINS</a></div>
      <div class="Col2">121.50</div>
      <div class="Col3">121.50</div>
      <div class="Col4">30</div>
    </div>
  </div>
</div>
<div class="caption1"><p>Issues Traded</p></div>
<div style="float:left;" class="value1"><p><font color=999900>174</font> &nbsp;
  <font color=green>42 &uarr;</font> &nbsp; <font color=red>112 &darr;</font> &nbsp;
  <font color=blue>20 &harr;</font></p></div>
<div class="caption1"><p>Volume</p></div>
<div style="float:left;" class="value1"><p><font color=999900>2,579,298</font></p></div>
<div class="caption1"><p>Value in Taka</p></div>
<div style="float:left;" class="value1"><p><font color=999900>110,175,452</font></p></div>
<div class="caption1"><p>Closing Market Cap.</p></div>
<div style="float:left;" class="value1"><p><font color=999900>9,515,448,241,057</font></p></div>
"""


# --- parsing ---------------------------------------------------------------


def test_each_top_ten_tab_keeps_its_own_columns():
    """The four tabs do not share a shape. Assuming the gainers' columns for
    all of them would label a 424,699-share volume as a 424,699% price move."""
    tables = market_svc._parse_top_tables(CSE_FIXTURE)

    assert tables["gainers"]["columns"] == ["Company", "LTP", "Change", "Change %"]
    assert tables["gainers"]["rows"] == [["SAIHAMTEX", "35.90", "3.00", "9.12"]]

    assert tables["volume"]["columns"] == ["Company", "YCP", "LTP", "Volume"]
    assert tables["volume"]["rows"] == [["PTL", "69.40", "71.40", "424699"]]

    assert tables["value"]["columns"][3] == "Value (mn)"


def test_losers_tab_survives_the_double_space_before_class():
    """CSE emits `<div  class="Col1">` on some rows. A single-space pattern
    misses that cell, which silently shifts every value in the row along."""
    tables = market_svc._parse_top_tables(CSE_FIXTURE)
    assert tables["losers"]["rows"] == [["HRTEX", "19.90", "-2.20", "-9.95"]]


def test_the_header_row_is_not_read_as_a_company():
    """The header carries the same ColN classes as the data rows."""
    for table in market_svc._parse_top_tables(CSE_FIXTURE).values():
        assert all(row[0].lower() != "company" for row in table["rows"])


def test_statistics_split_the_four_issues_traded_figures():
    stats = market_svc._parse_statistics(CSE_FIXTURE)
    assert stats["issuesTraded"] == 174
    assert (stats["advanced"], stats["declined"], stats["unchanged"]) == (42, 112, 20)
    assert stats["volume"] == 2579298
    assert stats["valueInTaka"] == 110175452
    assert stats["marketCap"] == 9515448241057


def test_parsers_return_empty_on_markup_they_do_not_recognise():
    """A CSE redesign must degrade this panel, not raise into the Overview."""
    assert market_svc._parse_statistics("<html><body>nothing</body></html>") == {}
    tables = market_svc._parse_top_tables("<html><body>nothing</body></html>")
    assert all(t["rows"] == [] for t in tables.values())


# --- endpoint --------------------------------------------------------------


def _cached_row(**overrides):
    row = {
        "index": "CSE50",
        "value": 1088.35,
        "change": -5.78,
        "change_pct": -0.52,
        "points": [{"label": "09:16", "value": 1094.13}],
        "top": {"gainers": {"columns": ["Company"], "rows": [["SAIHAMTEX"]]}},
        "stats": {"issuesTraded": 174},
        "fetched_at": datetime.now(timezone.utc),
    }
    row.update(overrides)
    return MarketSeries(**row)


async def test_a_fresh_snapshot_is_served_without_touching_cse(client, db, monkeypatch):
    """The whole point of the cache: an Overview reload must not become a
    request to someone else's server."""
    db.add(_cached_row())
    await db.commit()

    async def _explode(index):
        raise AssertionError("scraped despite a fresh cache")

    monkeypatch.setattr(market_svc, "_scrape", _explode)

    _auth(client)
    r = await client.get("/api/admin/analytics/market")
    assert r.status_code == 200
    body = r.json()
    assert body["value"] == 1088.35
    assert body["top"]["gainers"]["rows"] == [["SAIHAMTEX"]]
    assert body["indices"] == market_svc.INDICES


async def test_a_failed_scrape_keeps_the_last_good_snapshot(client, db, monkeypatch):
    """A stale market figure is worth more than an empty panel, and must not
    take the Overview's own revenue figures down with it."""
    db.add(_cached_row(fetched_at=datetime.now(timezone.utc) - timedelta(days=2)))
    await db.commit()

    async def _fail(index):
        raise RuntimeError("CSE unreachable")

    monkeypatch.setattr(market_svc, "_scrape", _fail)

    _auth(client)
    r = await client.get("/api/admin/analytics/market")
    assert r.status_code == 200
    assert r.json()["value"] == 1088.35


async def test_an_empty_scrape_does_not_overwrite_real_figures(client, db, monkeypatch):
    """A page that loads but parses to nothing -- a redesign, an interstitial
    -- must not replace yesterday's real prices with zeroes."""
    db.add(_cached_row(fetched_at=datetime.now(timezone.utc) - timedelta(days=2)))
    await db.commit()

    async def _empty(index):
        return {
            "index": "CSE50", "value": 0, "change": 0, "changePct": 0,
            "points": [], "top": {}, "stats": {},
        }

    monkeypatch.setattr(market_svc, "_scrape", _empty)

    _auth(client)
    r = await client.get("/api/admin/analytics/market")
    assert r.json()["value"] == 1088.35


async def test_no_cache_and_no_cse_returns_an_empty_snapshot_not_an_error(
    client, db, monkeypatch
):
    async def _fail(index):
        raise RuntimeError("CSE unreachable")

    monkeypatch.setattr(market_svc, "_scrape", _fail)

    _auth(client)
    r = await client.get("/api/admin/analytics/market")
    assert r.status_code == 200
    body = r.json()
    assert body["value"] == 0
    assert body["points"] == []
    assert body["indices"] == market_svc.INDICES


async def test_an_unknown_index_falls_back_rather_than_erroring(client, db, monkeypatch):
    db.add(_cached_row())
    await db.commit()
    monkeypatch.setattr(market_svc, "_scrape", lambda index: None)

    _auth(client)
    r = await client.get("/api/admin/analytics/market?index=NASDAQ")
    assert r.status_code == 200
    assert r.json()["index"] == "CSE50"


async def test_market_is_super_admin_only(client, db):
    # require_admin re-checks that the token's employee still exists, so the
    # row has to be there or this 401s as deleted before reaching the role
    # check being asserted on.
    db.add(
        Employee(
            id="emp-1", employee_id_number="emp-1", name="Sub", email="sub@x.com",
            password_hash="x", role="sub", access_options=[],
        )
    )
    await db.commit()

    _auth(client, role="sub", employee_id="emp-1")
    assert (await client.get("/api/admin/analytics/market")).status_code == 403


# --- stock position --------------------------------------------------------


async def test_stock_status_counts_by_quantity(client, db):
    """Counts come from stock_qty, matching derive_stock_status: under 10 is
    low, zero is out."""
    db.add(Category(slug="plc", name="PLC"))
    await db.flush()
    for slug, qty, price in [("a", 50, 10.0), ("b", 4, 20.0), ("c", 0, 30.0)]:
        db.add(
            Product(
                slug=slug, part_number=f"PN-{slug}", name=slug, brand="siemens",
                category_slug="plc", price=price, stock="in-stock", stock_qty=qty,
            )
        )
    await db.commit()

    _auth(client)
    r = await client.get("/api/admin/analytics/stock-status")
    assert r.status_code == 200
    body = r.json()
    assert (body["inStock"], body["lowStock"], body["outOfStock"]) == (1, 1, 1)
    assert body["totalUnits"] == 54
    assert body["stockValue"] == 580.0  # 50*10 + 4*20 + 0*30
