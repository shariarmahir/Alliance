import pytest

from app.models import Category, Product
from app.services.catalog import (
    create_category,
    create_product,
    default_stock_qty_for_status,
    derive_stock_status,
    delete_product,
    list_products,
    slugify,
    sync_category_product_counts,
    unique_slug,
    update_product_stock,
)


# --- pure helpers -----------------------------------------------------------


@pytest.mark.parametrize(
    "qty,expected",
    [
        (-5, "out-of-stock"),
        (0, "out-of-stock"),
        (1, "low-stock"),
        (9, "low-stock"),
        (10, "in-stock"),
        (500, "in-stock"),
    ],
)
def test_derive_stock_status_boundaries(qty, expected):
    assert derive_stock_status(qty) == expected


@pytest.mark.parametrize(
    "status,expected", [("in-stock", 50), ("low-stock", 5), ("out-of-stock", 0)]
)
def test_default_stock_qty_backfill(status, expected):
    assert default_stock_qty_for_status(status) == expected


@pytest.mark.parametrize(
    "name,expected",
    [
        ("Siemens S7-1200", "siemens-s7-1200"),
        ("  Spaced  Out  ", "spaced-out"),
        ("Symbols!!! @#$", "symbols"),
        ("MiXeD CaSe", "mixed-case"),
    ],
)
def test_slugify(name, expected):
    assert slugify(name) == expected


def test_unique_slug_appends_suffix_on_collision():
    existing = {"widget", "widget-2"}
    assert unique_slug("widget", existing) == "widget-3"
    assert unique_slug("other", existing) == "other"


def test_unique_slug_handles_empty_base():
    assert unique_slug("", set()) == "item"


# --- product persistence ----------------------------------------------------


async def _category(db, slug="plc", name="PLC"):
    category = Category(slug=slug, name=name)
    db.add(category)
    await db.commit()
    return category


async def test_create_product_derives_stock_and_slug(db):
    await _category(db)
    product = await create_product(
        db,
        {"name": "Siemens Drive", "part_number": "PN-1", "category_slug": "plc", "stock_qty": 3},
    )
    assert product.slug == "siemens-drive"
    assert product.stock == "low-stock"


async def test_create_product_seeds_gallery_from_image(db):
    await _category(db)
    product = await create_product(
        db,
        {
            "name": "Imaged",
            "part_number": "PN-IMG",
            "category_slug": "plc",
            "image": "/img/a.jpg",
        },
    )
    assert product.gallery == ["/img/a.jpg"]


async def test_duplicate_names_get_distinct_slugs(db):
    await _category(db)
    base = {"part_number": "PN-A", "category_slug": "plc", "name": "Same Name"}
    first = await create_product(db, base)
    second = await create_product(db, {**base, "part_number": "PN-B"})
    assert (first.slug, second.slug) == ("same-name", "same-name-2")


async def test_update_stock_rederives_status(db):
    await _category(db)
    await create_product(
        db, {"name": "P", "part_number": "PN-1", "category_slug": "plc", "stock_qty": 50}
    )
    updated = await update_product_stock(db, "p", 0)
    assert updated.stock == "out-of-stock"
    restocked = await update_product_stock(db, "p", 25)
    assert restocked.stock == "in-stock"


async def test_update_stock_returns_none_for_unknown_product(db):
    assert await update_product_stock(db, "ghost", 5) is None


async def test_category_product_count_stays_in_sync(db):
    category = await _category(db)
    for i in range(3):
        await create_product(
            db, {"name": f"P{i}", "part_number": f"PN-{i}", "category_slug": "plc"}
        )
    await db.refresh(category)
    assert category.product_count == 3

    await delete_product(db, "p0")
    await db.refresh(category)
    assert category.product_count == 2


async def test_list_products_filters_and_paginates(db):
    await _category(db)
    await _category(db, "servo", "Servo")
    for i in range(5):
        await create_product(
            db,
            {
                "name": f"Widget {i}",
                "part_number": f"WID-{i}",
                "category_slug": "plc",
                "brand": "siemens",
                "price": float(i),
            },
        )
    await create_product(
        db, {"name": "Servo Motor", "part_number": "SRV-1", "category_slug": "servo"}
    )

    items, total = await list_products(db, category="plc")
    assert total == 5

    items, total = await list_products(db, search="servo")
    assert total == 1 and items[0].part_number == "SRV-1"

    items, total = await list_products(db, category="plc", page=1, page_size=2)
    assert len(items) == 2 and total == 5

    items, _ = await list_products(db, category="plc", sort="price-desc")
    assert items[0].price == 4.0


async def test_search_matches_part_number_case_insensitively(db):
    await _category(db)
    await create_product(
        db, {"name": "Thing", "part_number": "ABC-123", "category_slug": "plc"}
    )
    _, total = await list_products(db, search="abc-1")
    assert total == 1
