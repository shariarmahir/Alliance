"""The Overview's market and stock-position panels.

The market panel talks to a third-party API on a five-requests-a-minute free
tier, so the things worth pinning down are the ones that keep a dashboard
standing when that API misbehaves: no key, an outage, and a cache that stops
the Overview hammering the provider once per page load.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.models import Category, MarketSeries, Product
from app.schemas.session import AdminSession


def _auth(client, role="super", **kwargs):
    client.cookies.set(
        ADMIN_SESSION_COOKIE,
        create_session_token(AdminSession(role=role, name="A", email="a@x.com", **kwargs)),
    )


def _bars(closes):
    start = datetime(2026, 6, 1, tzinfo=timezone.utc)
    return [
        {
            "t": int((start + timedelta(weeks=i)).timestamp() * 1000),
            "o": c, "h": c, "l": c, "c": c, "v": 1000,
        }
        for i, c in enumerate(closes)
    ]


async def test_market_without_an_api_key_returns_empty_not_an_error(client, db, monkeypatch):
    """The panel must degrade to its empty state: an unconfigured market feed
    is not a reason for the whole Overview to fail."""
    from app.config import settings

    monkeypatch.setattr(settings, "massive_api_key", None)
    _auth(client)
    r = await client.get("/api/admin/analytics/market")
    assert r.status_code == 200
    assert r.json() == []


async def test_market_serves_the_cache_without_calling_the_provider(client, db, monkeypatch):
    """A fresh row must not trigger a fetch. The free tier allows five
    requests a minute, so one call per page load would fail as soon as two
    admins opened the Overview."""
    from app.config import settings
    from app.services import market as market_svc

    db.add(
        MarketSeries(
            ticker="SIEGY", label="Siemens", bars=_bars([100.0, 110.0]),
            latest_close=110.0, change_pct=10.0, week_volume=1000,
            fetched_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()

    monkeypatch.setattr(settings, "massive_api_key", "test-key")

    async def _explode(*args, **kwargs):
        raise AssertionError("fetched despite a fresh cache")

    monkeypatch.setattr(market_svc, "_fetch_bars", _explode)

    _auth(client)
    r = await client.get("/api/admin/analytics/market")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["ticker"] == "SIEGY"
    assert body[0]["latestClose"] == 110.0


async def test_market_keeps_stale_data_when_the_provider_fails(client, db, monkeypatch):
    """A failed refresh must leave the last good prices on screen rather than
    blanking the panel — a stale price is worth more than no price."""
    from app.config import settings
    from app.services import market as market_svc

    db.add(
        MarketSeries(
            ticker="SIEGY", label="Siemens", bars=_bars([100.0, 110.0]),
            latest_close=110.0, change_pct=10.0, week_volume=1000,
            fetched_at=datetime.now(timezone.utc) - timedelta(days=30),
        )
    )
    await db.commit()

    monkeypatch.setattr(settings, "massive_api_key", "test-key")
    monkeypatch.setattr(market_svc, "_REQUEST_GAP_SECONDS", 0)

    async def _fail(client_, ticker):
        raise RuntimeError("rate limited")

    monkeypatch.setattr(market_svc, "_fetch_bars", _fail)

    _auth(client)
    r = await client.get("/api/admin/analytics/market")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["latestClose"] == 110.0


async def test_market_is_super_admin_only(client, db):
    # require_admin re-checks that the token's employee still exists, so the
    # row has to be there or this 401s as deleted before reaching the role
    # check we are actually asserting on.
    from app.models import Employee

    db.add(
        Employee(
            id="emp-1", employee_id_number="emp-1", name="Sub", email="sub@x.com",
            password_hash="x", role="sub", access_options=[],
        )
    )
    await db.commit()

    _auth(client, role="sub", employee_id="emp-1")
    assert (await client.get("/api/admin/analytics/market")).status_code == 403


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
    assert body["inStock"] == 1
    assert body["lowStock"] == 1
    assert body["outOfStock"] == 1
    assert body["totalUnits"] == 54
    # 50*10 + 4*20 + 0*30
    assert body["stockValue"] == 580.0
