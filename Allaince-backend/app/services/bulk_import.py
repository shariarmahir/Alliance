import re
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Product
from app.schemas.catalog import StockStatus
from app.services.catalog import (
    default_stock_qty_for_status,
    derive_stock_status,
    slugify,
    sync_category_product_counts,
    unique_slug,
)

LINE_RE = re.compile(r"^(\d+)\.\s*(.+)$")
IMAGE_NUM_RE = re.compile(r"^(\d+)[.\-_]")
VALID_STOCK: tuple[StockStatus, ...] = ("in-stock", "low-stock", "out-of-stock")


@dataclass
class ImportError_:
    line_number: int | None
    message: str


@dataclass
class BulkRow:
    line_number: int
    name: str
    part_number: str
    price: float
    short_specs: str
    stock: StockStatus


@dataclass
class ParseResult:
    rows: list[BulkRow] = field(default_factory=list)
    errors: list[ImportError_] = field(default_factory=list)


def parse_bulk_text(text: str) -> ParseResult:
    """Parses the numbered `N. name | part | price | specs | stock` format.

    Collects every error rather than stopping at the first, so the admin sees
    the whole batch's problems in one pass.
    """
    result = ParseResult()
    lines = [line.strip() for line in text.split("\n") if line.strip()]

    for line in lines:
        match = LINE_RE.match(line)
        if not match:
            result.errors.append(
                ImportError_(None, f'Line does not match the expected "N. ..." format: "{line}"')
            )
            continue

        line_number = int(match.group(1))
        fields = [f.strip() for f in match.group(2).split("|")]

        if len(fields) != 5:
            result.errors.append(
                ImportError_(
                    line_number,
                    f'Expected 5 fields separated by "|" (name, part number, price, '
                    f"short specs, stock), found {len(fields)}.",
                )
            )
            continue

        name, part_number, raw_price, short_specs, stock = fields
        row_errors: list[str] = []
        try:
            price = float(raw_price)
        except ValueError:
            price = float("nan")
        if not name:
            row_errors.append("name is empty")
        if not part_number:
            row_errors.append("part number is empty")
        if not raw_price or price != price or price < 0:  # price != price catches NaN
            row_errors.append("price is not a valid non-negative number")
        if stock not in VALID_STOCK:
            row_errors.append(f"stock must be one of {', '.join(VALID_STOCK)}")

        if row_errors:
            result.errors.append(ImportError_(line_number, f"Invalid line: {', '.join(row_errors)}."))
            continue

        result.rows.append(
            BulkRow(line_number, name, part_number, price, short_specs, stock)  # type: ignore[arg-type]
        )

    if not lines:
        result.errors.append(ImportError_(None, "No product lines were provided."))

    return result


def match_images(
    filenames: list[str], rows: list[BulkRow]
) -> tuple[dict[int, str], list[ImportError_]]:
    """Matches images to lines by the leading number in the filename.

    Every line needs exactly one image and every image exactly one line —
    a mismatch in either direction is an error, so a silently unillustrated
    product cannot slip into the catalog.
    """
    errors: list[ImportError_] = []
    by_number: dict[int, str] = {}

    for filename in filenames:
        match = IMAGE_NUM_RE.match(filename)
        if not match:
            errors.append(
                ImportError_(
                    None,
                    f'Image "{filename}" does not start with a number and cannot be '
                    f"matched to a product line.",
                )
            )
            continue
        num = int(match.group(1))
        if num in by_number:
            errors.append(
                ImportError_(
                    None,
                    f"Multiple images match number {num} (only one image per product "
                    f"line is allowed).",
                )
            )
            continue
        by_number[num] = filename

    row_numbers = {r.line_number for r in rows}
    for row in rows:
        if row.line_number not in by_number:
            errors.append(
                ImportError_(row.line_number, f"No image uploaded for product #{row.line_number}.")
            )
    for num, filename in by_number.items():
        if num not in row_numbers:
            errors.append(
                ImportError_(
                    None,
                    f'Image "{filename}" does not match any product line '
                    f'(no line starting with "{num}.").',
                )
            )

    return by_number, errors


async def check_part_number_collisions(
    db: AsyncSession, rows: list[BulkRow]
) -> list[ImportError_]:
    existing = {
        part_number.lower()
        for part_number in (await db.execute(select(Product.part_number))).scalars().all()
    }
    return [
        ImportError_(
            row.line_number,
            f'Part number "{row.part_number}" already exists in the catalog.',
        )
        for row in rows
        if row.part_number.lower() in existing
    ]


async def commit_bulk_import(
    db: AsyncSession,
    category_slug: str,
    rows: list[BulkRow],
    image_paths: dict[int, str],
) -> list[Product]:
    """Writes the validated batch. Callers must have resolved every error
    first — this is the all-or-nothing commit step."""
    existing_slugs = {p.slug for p in (await db.execute(select(Product))).scalars().all()}
    created: list[Product] = []

    for row in rows:
        slug = unique_slug(slugify(row.name), existing_slugs)
        existing_slugs.add(slug)
        image = image_paths.get(row.line_number, "")
        stock_qty = default_stock_qty_for_status(row.stock)
        short_specs = [s.strip() for s in row.short_specs.split(",") if s.strip()]

        product = Product(
            slug=slug,
            part_number=row.part_number,
            name=row.name,
            brand="",
            category_slug=category_slug,
            image=image,
            gallery=[image] if image else [],
            short_specs=short_specs,
            description=short_specs,
            alternate_part_numbers=[],
            specifications={},
            price=row.price,
            stock=derive_stock_status(stock_qty),
            stock_qty=stock_qty,
            warranty_years=2,
        )
        db.add(product)
        created.append(product)

    await db.commit()
    await sync_category_product_counts(db)
    for product in created:
        await db.refresh(product)
    return created
