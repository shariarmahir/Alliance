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


async def test_the_edit_dialog_payload_updates_every_field_it_sends(client, db):
    """The Edit Product dialog PATCHes exactly these fields. If the endpoint
    silently ignored one, an admin would correct a price on screen, see a
    success toast, and find the old figure still there on refresh."""
    product = await _create(client)
    _auth(client)

    cat = await client.post("/api/admin/categories", json={"name": "Sensors"})
    new_category = cat.json()["slug"]

    r = await client.patch(
        f"/api/admin/products/{product['slug']}",
        json={
            "name": "Renamed Drive",
            "partNumber": "PN-PRICE-2",
            "categorySlug": new_category,
            "brand": "omron",
            "price": 4321.0,
            "stockQty": 12,
            "warrantyYears": 3,
        },
    )
    assert r.status_code == 200, r.text
    updated = r.json()
    assert updated["name"] == "Renamed Drive"
    assert updated["partNumber"] == "PN-PRICE-2"
    assert updated["categorySlug"] == new_category
    assert updated["brand"] == "omron"
    assert updated["price"] == 4321.0
    assert updated["stockQty"] == 12
    assert updated["warrantyYears"] == 3

    # And it survives a re-read rather than only echoing back.
    again = await client.get("/api/admin/products")
    row = next(x for x in again.json()["items"] if x["slug"] == product["slug"])
    assert row["price"] == 4321.0
    assert row["stockQty"] == 12


async def test_the_admin_endpoint_is_the_only_one_that_carries_the_price(client, db):
    """The two product endpoints differ by exactly one field, and an admin
    screen that reads the public one shows every price as "Not set" no matter
    what was saved. That is not a visible failure -- no error, no empty list,
    just a wrong number -- so it is pinned here.
    """
    product = await _create(client)

    _auth(client)
    admin_row = next(
        p for p in (await client.get("/api/admin/products")).json()["items"]
        if p["slug"] == product["slug"]
    )

    client.cookies.clear()
    public_row = next(
        p for p in (await client.get("/api/products")).json()["items"]
        if p["slug"] == product["slug"]
    )

    assert "price" in admin_row
    assert "price" not in public_row
    # Everything else must match, or the two screens disagree about the
    # catalogue itself rather than just the price.
    assert set(admin_row) - set(public_row) == {"price"}


async def test_a_product_can_introduce_a_brand_that_does_not_exist_yet(client, db):
    """Brands are implied by products rather than managed on their own screen,
    so the Add Product form must accept a name that is not in the list. A
    dropdown limited to existing brands makes the first product of any new
    make impossible to catalogue."""
    _auth(client)
    cat = await client.post("/api/admin/categories", json={"name": "Drives"})
    r = await client.post("/api/admin/products", json={
        "partNumber": "PN-NEWBRAND-1",
        "name": "Delta VFD",
        "brand": "Delta Electronics",
        "categorySlug": cat.json()["slug"],
        "stockQty": 3,
    })
    assert r.status_code == 201, r.text
    assert r.json()["brand"] == "Delta Electronics"

    # And it becomes selectable for the next product.
    brands = (await client.get("/api/brands")).json()
    assert any(b["name"] == "Delta Electronics" for b in brands)


async def test_an_edited_product_can_move_to_a_brand_that_does_not_exist_yet(client, db):
    product = await _create(client)
    _auth(client)
    r = await client.patch(
        f"/api/admin/products/{product['slug']}", json={"brand": "Fuji Electric"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["brand"] == "Fuji Electric"
    brands = (await client.get("/api/brands")).json()
    assert any(b["name"] == "Fuji Electric" for b in brands)
