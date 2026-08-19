from app.models import Category, Product
from app.services.bulk_import import (
    check_part_number_collisions,
    commit_bulk_import,
    match_images,
    parse_bulk_text,
)

GOOD = "1. Siemens PLC | PN-100 | 250.50 | 24V, DIN rail | in-stock"


def test_parses_a_valid_line():
    result = parse_bulk_text(GOOD)
    assert result.errors == []
    row = result.rows[0]
    assert (row.line_number, row.name, row.part_number, row.price, row.stock) == (
        1,
        "Siemens PLC",
        "PN-100",
        250.50,
        "in-stock",
    )


def test_blank_lines_are_skipped():
    result = parse_bulk_text(f"\n\n{GOOD}\n\n")
    assert len(result.rows) == 1 and result.errors == []


def test_rejects_line_without_leading_number():
    result = parse_bulk_text("Siemens PLC | PN-1 | 5 | x | in-stock")
    assert result.rows == []
    assert "expected" in result.errors[0].message.lower()


def test_rejects_wrong_field_count():
    result = parse_bulk_text("1. Only | Three | Fields")
    assert result.errors[0].line_number == 1
    assert "found 3" in result.errors[0].message


def test_rejects_negative_and_non_numeric_price():
    for bad in ("-5", "abc"):
        result = parse_bulk_text(f"1. N | PN | {bad} | s | in-stock")
        assert "price is not a valid non-negative number" in result.errors[0].message


def test_rejects_invalid_stock_status():
    result = parse_bulk_text("1. N | PN | 5 | s | plenty")
    assert "stock must be one of" in result.errors[0].message


def test_reports_every_problem_on_one_line_together():
    result = parse_bulk_text("1.  | | -1 | s | nope")
    message = result.errors[0].message
    assert "name is empty" in message
    assert "part number is empty" in message
    assert "price" in message
    assert "stock" in message


def test_empty_text_is_an_error():
    assert parse_bulk_text("   ").errors[0].message == "No product lines were provided."


# --- image matching ---------------------------------------------------------


def test_matches_images_by_leading_number():
    rows = parse_bulk_text(f"{GOOD}\n2. Second | PN-2 | 10 | s | low-stock").rows
    by_number, errors = match_images(["1.jpg", "2-photo.png"], rows)
    assert errors == []
    assert by_number == {1: "1.jpg", 2: "2-photo.png"}


def test_image_without_leading_number_is_an_error():
    rows = parse_bulk_text(GOOD).rows
    _, errors = match_images(["1.jpg", "cover.jpg"], rows)
    assert any("does not start with a number" in e.message for e in errors)


def test_duplicate_image_numbers_are_rejected():
    rows = parse_bulk_text(GOOD).rows
    _, errors = match_images(["1.jpg", "1_alt.jpg"], rows)
    assert any("Multiple images match number 1" in e.message for e in errors)


def test_line_missing_an_image_is_an_error():
    rows = parse_bulk_text(f"{GOOD}\n2. Second | PN-2 | 10 | s | low-stock").rows
    _, errors = match_images(["1.jpg"], rows)
    assert any(e.line_number == 2 and "No image uploaded" in e.message for e in errors)


def test_image_matching_no_line_is_an_error():
    rows = parse_bulk_text(GOOD).rows
    _, errors = match_images(["1.jpg", "7.jpg"], rows)
    assert any("does not match any product line" in e.message for e in errors)


# --- persistence ------------------------------------------------------------


async def _category(db):
    db.add(Category(slug="plc", name="PLC"))
    await db.commit()


async def test_part_number_collision_is_detected(db):
    await _category(db)
    db.add(Product(slug="x", part_number="PN-100", name="X", brand="", category_slug="plc"))
    await db.commit()

    rows = parse_bulk_text(GOOD).rows
    errors = await check_part_number_collisions(db, rows)
    assert len(errors) == 1 and "already exists" in errors[0].message


async def test_collision_check_is_case_insensitive(db):
    await _category(db)
    db.add(Product(slug="x", part_number="pn-100", name="X", brand="", category_slug="plc"))
    await db.commit()
    assert await check_part_number_collisions(db, parse_bulk_text(GOOD).rows)


async def test_commit_writes_products_with_derived_fields(db):
    await _category(db)
    rows = parse_bulk_text(GOOD).rows
    created = await commit_bulk_import(db, "plc", rows, {1: "/images/1.jpg"})

    product = created[0]
    assert product.slug == "siemens-plc"
    # in-stock backfills to 50, which re-derives to in-stock.
    assert (product.stock_qty, product.stock) == (50, "in-stock")
    assert product.short_specs == ["24V", "DIN rail"]
    assert product.gallery == ["/images/1.jpg"]
    assert product.warranty_years == 2


async def test_commit_updates_category_count(db):
    await _category(db)
    rows = parse_bulk_text(f"{GOOD}\n2. Second | PN-2 | 10 | s | low-stock").rows
    await commit_bulk_import(db, "plc", rows, {1: "/a.jpg", 2: "/b.jpg"})
    category = await db.get(Category, "plc")
    await db.refresh(category)
    assert category.product_count == 2
