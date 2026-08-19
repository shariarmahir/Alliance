from fastapi import APIRouter, HTTPException, Query, status

from app.core.deps import DbSession
from app.schemas.catalog import (
    BrandOut,
    CategoryOut,
    HeroImageOut,
    ProductListOut,
    ProductOut,
    TopSellerOut,
)
from app.services import catalog as svc
from app.services.analytics import top_sellers

# Public, unauthenticated storefront reads. These serve the same `products`
# table the admin screens write, so catalog edits are visible immediately —
# the old frontend read a separate hardcoded dataset and never reflected them.
router = APIRouter(prefix="/api", tags=["catalog"])


@router.get("/products", response_model=ProductListOut)
async def list_products(
    db: DbSession,
    category: str | None = None,
    brand: str | None = None,
    q: str | None = None,
    stock: str | None = None,
    sort: str = "name",
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100, alias="pageSize"),
):
    items, total = await svc.list_products(
        db,
        category=category,
        brand=brand,
        search=q,
        stock=stock,
        page=page,
        page_size=page_size,
        sort=sort,
    )
    return ProductListOut(
        items=[ProductOut.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/products/{slug}", response_model=ProductOut)
async def get_product(slug: str, db: DbSession):
    product = await svc.get_product(db, slug)
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")
    return ProductOut.model_validate(product)


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: DbSession):
    return [CategoryOut.model_validate(c) for c in await svc.list_categories(db)]


@router.get("/brands", response_model=list[BrandOut])
async def list_brands(db: DbSession):
    return [BrandOut.model_validate(b) for b in await svc.list_brands(db)]


@router.get("/hero-images", response_model=list[HeroImageOut])
async def list_hero_images(db: DbSession):
    return [HeroImageOut.model_validate(h) for h in await svc.list_hero_images(db)]


@router.get("/top-sellers", response_model=list[TopSellerOut])
async def get_top_sellers(
    db: DbSession,
    period: str = Query("month", pattern="^(week|month|year)$"),
    limit: int = Query(8, ge=1, le=24),
):
    """Real top sellers, aggregated from issued order confirmations.

    Replaces the fabricated week/month/year rank fields the storefront used.
    """
    return await top_sellers(db, period=period, limit=limit)
