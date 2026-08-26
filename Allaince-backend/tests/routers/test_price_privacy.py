"""Product prices are for admins only.

This is a quotation-based B2B site: a customer asks for a price and the
business decides what to offer them. A cost sitting in the public catalogue
response undercuts that -- it is visible to anyone, including competitors,
and it is not the number the customer would be quoted.
"""

import pytest

from app.core.rate_limit import reset_in_memory_buckets
from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.schemas.session import AdminSession


@pytest.fixture(autouse=True)
def _clear_rate_limits():
    reset_in_memory_buckets()
    yield
    reset_in_memory_buckets()


def _auth(client, role="super", **kwargs):
    client.cookies.set(
        ADMIN_SESSION_COOKIE,
        create_session_token(AdminSession(role=role, name="A", email="a@x.com", **kwargs)),
    )


PRODUCT = {
    "partNumber": "PN-PRICE-1",
    "name": "Priced Drive",
    "brand": "siemens",
    "categorySlug": "drives",
    "price": 12345.67,
    "stockQty": 5,
}


async def _create(client):
    _auth(client)
    # A product needs a real category, the same as through the admin screen.
    cat = await client.post("/api/admin/categories", json={"name": "Drives"})
    assert cat.status_code in (200, 201), cat.text
    payload = {**PRODUCT, "categorySlug": cat.json()["slug"]}
    r = await client.post("/api/admin/products", json=payload)
    assert r.status_code == 201, r.text
    return r.json()


async def test_the_public_catalogue_does_not_expose_the_price(client, db):
    product = await _create(client)
    client.cookies.clear()          # a plain visitor

    listing = await client.get("/api/products")
    assert listing.status_code == 200
    rows = [p for p in listing.json()["items"] if p["slug"] == product["slug"]]
    assert rows, "the product should still be listed publicly"
    assert "price" not in rows[0], "the storefront must not carry the price"

    detail = await client.get(f"/api/products/{product['slug']}")
    assert detail.status_code == 200
    assert "price" not in detail.json()


async def test_an_admin_still_sees_the_price(client, db):
    product = await _create(client)
    _auth(client)

    listing = await client.get("/api/admin/products")
    row = next(p for p in listing.json()["items"] if p["slug"] == product["slug"])
    assert row["price"] == 12345.67


async def test_the_price_is_saved_when_a_product_is_added(client, db):
    product = await _create(client)
    assert product["price"] == 12345.67


async def test_the_price_can_be_corrected(client, db):
    product = await _create(client)
    _auth(client)
    r = await client.patch(
        f"/api/admin/products/{product['slug']}", json={"price": 999.5}
    )
    assert r.status_code == 200
    assert r.json()["price"] == 999.5
