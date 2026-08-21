import re

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Brand, Category, HeroImage, Product
from app.schemas.catalog import StockStatus

# ---------------------------------------------------------------------------
# Slugs and stock
# ---------------------------------------------------------------------------

_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_EDGE_DASH = re.compile(r"^-+|-+$")


def slugify(name: str) -> str:
    return _EDGE_DASH.sub("", _NON_ALNUM.sub("-", name.lower().strip()))


def unique_slug(base: str, existing: set[str]) -> str:
    """Appends -2, -3, ... on collision rather than erroring: product names
    legitimately repeat across variants."""
    if not base:
        base = "item"
    candidate = base
    n = 2
    while candidate in existing:
        candidate = f"{base}-{n}"
        n += 1
    return candidate


def derive_stock_status(qty: int) -> StockStatus:
    if qty <= 0:
        return "out-of-stock"
    if qty < 10:
        return "low-stock"
    return "in-stock"


def default_stock_qty_for_status(status: StockStatus) -> int:
    """Backfill used by bulk import, which states a status rather than a count."""
    if status == "in-stock":
        return 50
    if status == "low-stock":
        return 5
    return 0


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------


async def list_categories(db: AsyncSession) -> list[Category]:
    return list((await db.execute(select(Category).order_by(Category.name))).scalars().all())


async def get_category(db: AsyncSession, slug: str) -> Category | None:
    return await db.get(Category, slug)


async def create_category(db: AsyncSession, name: str, icon: str = "") -> Category:
    existing = {c.slug for c in await list_categories(db)}
    category = Category(slug=unique_slug(slugify(name), existing), name=name.strip(), icon=icon)
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


class CategoryInUse(ValueError):
    """Refused: products still reference this category."""

    def __init__(self, product_count: int) -> None:
        self.product_count = product_count
        super().__init__(
            f"{product_count} product(s) still use this category. "
            "Move or delete them first."
        )


async def rename_category(db: AsyncSession, slug: str, name: str) -> Category | None:
    """Changes the display name only.

    The slug stays put deliberately. It is the primary key products point at
    and it appears in storefront URLs, so regenerating it from the new name
    would orphan every product in the category and break any link already
    shared. A rename here is a label change, not a re-identification.
    """
    category = await db.get(Category, slug)
    if category is None:
        return None
    category.name = name.strip()
    await db.commit()
    await db.refresh(category)
    return category


async def delete_category(db: AsyncSession, slug: str) -> bool:
    """Deletes an empty category. Raises CategoryInUse when products remain.

    The FK is ON DELETE RESTRICT, so the database would refuse this anyway —
    but it would surface as an opaque IntegrityError well after the fact.
    Counting first turns that into an answer the admin can act on.
    """
    category = await db.get(Category, slug)
    if category is None:
        return False

    in_use = (
        await db.execute(
            select(func.count())
            .select_from(Product)
            .where(Product.category_slug == slug)
        )
    ).scalar_one()
    if in_use:
        raise CategoryInUse(in_use)

    await db.delete(category)
    await db.commit()
    return True


async def sync_category_product_counts(db: AsyncSession) -> None:
    """Recompute the denormalized product_count after any product write.

    Both the admin categories tab and the storefront grid read the stored
    count directly, so this is the one place it has to stay accurate.
    """
    counts = dict(
        (
            await db.execute(
                select(Product.category_slug, func.count()).group_by(Product.category_slug)
            )
        ).all()
    )
    changed = False
    for category in await list_categories(db):
        expected = int(counts.get(category.slug, 0))
        if category.product_count != expected:
            category.product_count = expected
            changed = True
    if changed:
        await db.commit()


# ---------------------------------------------------------------------------
# Brands
# ---------------------------------------------------------------------------


async def list_brands(db: AsyncSession) -> list[Brand]:
    return list((await db.execute(select(Brand).order_by(Brand.name))).scalars().all())


async def ensure_brand(db: AsyncSession, name: str) -> Brand | None:
    """Brands are implied by products rather than managed directly, so a
    product referencing a new brand creates it.

    The logo follows the storefront's naming convention rather than being left
    empty. There is no admin screen for uploading a brand logo, so an empty
    string here is permanent, and the storefront rendered it as a broken image.
    Pointing at the conventional path means dropping a correctly-named file in
    is all it takes; the storefront falls back to a text wordmark when no such
    file exists, so a guessed path costs nothing when it is wrong.
    """
    if not name or not name.strip():
        return None
    slug = slugify(name)
    existing = await db.get(Brand, slug)
    if existing:
        return existing
    brand = Brand(slug=slug, name=name.strip(), logo=f"/images/brands/{slug}.png")
    db.add(brand)
    await db.flush()
    return brand


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------


async def get_product(db: AsyncSession, slug: str) -> Product | None:
    return await db.get(Product, slug)


async def find_product_by_part_number(db: AsyncSession, part_number: str) -> Product | None:
    return (
        await db.execute(
            select(Product).where(func.lower(Product.part_number) == part_number.lower())
        )
    ).scalar_one_or_none()


async def list_products(
    db: AsyncSession,
    *,
    category: str | None = None,
    brand: str | None = None,
    search: str | None = None,
    stock: str | None = None,
    page: int = 1,
    page_size: int = 24,
    sort: str = "name",
) -> tuple[list[Product], int]:
    stmt = select(Product)
    if category:
        stmt = stmt.where(Product.category_slug == category)
    if brand:
        stmt = stmt.where(Product.brand == brand)
    if stock:
        stmt = stmt.where(Product.stock == stock)
    if search and search.strip():
        needle = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            func.lower(Product.name).like(needle)
            | func.lower(Product.part_number).like(needle)
            | func.lower(Product.brand).like(needle)
        )

    total = int((await db.execute(select(func.count()).select_from(stmt.subquery()))).scalar_one())

    order = {
        "name": Product.name.asc(),
        "price-asc": Product.price.asc(),
        "price-desc": Product.price.desc(),
        "newest": Product.created_at.desc(),
    }.get(sort, Product.name.asc())

    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    rows = (
        (await db.execute(stmt.order_by(order).offset((page - 1) * page_size).limit(page_size)))
        .scalars()
        .all()
    )
    return list(rows), total


async def create_product(db: AsyncSession, data: dict) -> Product:
    existing = {p.slug for p in (await db.execute(select(Product))).scalars().all()}
    stock_qty = int(data.get("stock_qty", 0))
    image = data.get("image", "")
    product = Product(
        slug=unique_slug(slugify(data["name"]), existing),
        part_number=data["part_number"],
        name=data["name"],
        brand=data.get("brand", ""),
        category_slug=data["category_slug"],
        image=image,
        gallery=data.get("gallery") or ([image] if image else []),
        short_specs=data.get("short_specs", []),
        description=data.get("description", []),
        alternate_part_numbers=data.get("alternate_part_numbers", []),
        specifications=data.get("specifications", {}),
        price=float(data.get("price", 0)),
        stock=derive_stock_status(stock_qty),
        stock_qty=stock_qty,
        warranty_years=int(data.get("warranty_years", 1)),
    )
    await ensure_brand(db, product.brand)
    db.add(product)
    await db.commit()
    await sync_category_product_counts(db)
    await db.refresh(product)
    return product


async def update_product(db: AsyncSession, slug: str, patch: dict) -> Product | None:
    product = await get_product(db, slug)
    if product is None:
        return None
    for key, value in patch.items():
        if value is None or not hasattr(product, key):
            continue
        setattr(product, key, value)
    # Status is always derived, never accepted from the client.
    if patch.get("stock_qty") is not None:
        product.stock = derive_stock_status(product.stock_qty)
    if patch.get("brand"):
        await ensure_brand(db, product.brand)
    await db.commit()
    await sync_category_product_counts(db)
    await db.refresh(product)
    return product


async def update_product_stock(db: AsyncSession, slug: str, stock_qty: int) -> Product | None:
    product = await get_product(db, slug)
    if product is None:
        return None
    product.stock_qty = stock_qty
    product.stock = derive_stock_status(stock_qty)
    await db.commit()
    await db.refresh(product)
    return product


async def delete_product(db: AsyncSession, slug: str) -> bool:
    product = await get_product(db, slug)
    if product is None:
        return False
    await db.delete(product)
    await db.commit()
    await sync_category_product_counts(db)
    return True


# ---------------------------------------------------------------------------
# Hero images
# ---------------------------------------------------------------------------


async def list_hero_images(db: AsyncSession) -> list[HeroImage]:
    return list((await db.execute(select(HeroImage).order_by(HeroImage.slot))).scalars().all())


async def set_hero_image(db: AsyncSession, slot: int, path: str) -> HeroImage:
    entry = await db.get(HeroImage, slot)
    if entry is None:
        entry = HeroImage(slot=slot, path=path)
        db.add(entry)
    else:
        entry.path = path
    await db.commit()
    await db.refresh(entry)
    return entry
