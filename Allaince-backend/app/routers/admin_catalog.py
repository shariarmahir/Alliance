from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse

from app.core.deps import AdminDep, DbSession
from app.integrations.object_storage import (
    ImageRejected,
    cache_busted,
    category_icon_key,
    hero_image_key,
    product_image_key,
    safe_filename,
    save_image,
    validate_image,
)
from app.schemas.catalog import (
    CategoryCreate,
    CategoryOut,
    HeroImageOut,
    ProductCreate,
    ProductListOut,
    ProductOut,
    ProductUpdate,
    StockUpdate,
)
from app.services import bulk_import as bulk
from app.services import catalog as svc

# Catalog writes are open to any authenticated admin (super or sub) — the same
# rule the frontend's sub-admin allowlist applied.
router = APIRouter(prefix="/api/admin", tags=["admin-catalog"], dependencies=[])


@router.get("/products", response_model=ProductListOut)
async def list_products(
    session: AdminDep,
    db: DbSession,
    category: str | None = None,
    q: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    items, total = await svc.list_products(
        db, category=category, search=q, page=page, page_size=page_size
    )
    return ProductListOut(
        items=[ProductOut.model_validate(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
async def create_product(payload: ProductCreate, session: AdminDep, db: DbSession):
    if await svc.get_category(db, payload.category_slug) is None:
        raise HTTPException(status_code=400, detail="Unknown category.")
    if await svc.find_product_by_part_number(db, payload.part_number):
        raise HTTPException(
            status_code=409,
            detail=f'Part number "{payload.part_number}" already exists in the catalog.',
        )
    product = await svc.create_product(db, payload.model_dump())
    return ProductOut.model_validate(product)


@router.patch("/products/{slug}", response_model=ProductOut)
async def update_product(slug: str, payload: ProductUpdate, session: AdminDep, db: DbSession):
    patch = payload.model_dump(exclude_unset=True)
    if patch.get("part_number"):
        clash = await svc.find_product_by_part_number(db, patch["part_number"])
        if clash and clash.slug != slug:
            raise HTTPException(status_code=409, detail="Part number already exists.")
    product = await svc.update_product(db, slug, patch)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found.")
    return ProductOut.model_validate(product)


@router.delete("/products/{slug}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(slug: str, session: AdminDep, db: DbSession):
    if not await svc.delete_product(db, slug):
        raise HTTPException(status_code=404, detail="Product not found.")


@router.patch("/products/{slug}/stock", response_model=ProductOut)
async def update_stock(slug: str, payload: StockUpdate, session: AdminDep, db: DbSession):
    product = await svc.update_product_stock(db, slug, payload.stock_qty)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found.")
    return ProductOut.model_validate(product)


@router.post("/products/{slug}/image", response_model=ProductOut)
async def upload_product_image(
    slug: str, session: AdminDep, db: DbSession, file: UploadFile = File(...)
):
    product = await svc.get_product(db, slug)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found.")

    content = await file.read()
    try:
        ext = validate_image(file.filename or "", content, file.content_type)
        url = save_image(
            product_image_key(product.category_slug, f"{slug}{ext}"), content, file.content_type
        )
    except ImageRejected as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated = await svc.update_product(db, slug, {"image": url, "gallery": [url]})
    return ProductOut.model_validate(updated)


# --- Categories -------------------------------------------------------------


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(session: AdminDep, db: DbSession):
    return [CategoryOut.model_validate(c) for c in await svc.list_categories(db)]


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(payload: CategoryCreate, session: AdminDep, db: DbSession):
    category = await svc.create_category(db, payload.name, payload.icon)
    return CategoryOut.model_validate(category)


@router.post("/categories/{slug}/icon", response_model=CategoryOut)
async def upload_category_icon(
    slug: str, session: AdminDep, db: DbSession, file: UploadFile = File(...)
):
    category = await svc.get_category(db, slug)
    if category is None:
        raise HTTPException(status_code=404, detail="Category not found.")

    content = await file.read()
    try:
        ext = validate_image(file.filename or "", content, file.content_type)
        category.icon = save_image(category_icon_key(slug, ext), content, file.content_type)
    except ImageRejected as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    await db.commit()
    await db.refresh(category)
    return CategoryOut.model_validate(category)


# --- Hero images ------------------------------------------------------------


@router.get("/hero-images", response_model=list[HeroImageOut])
async def list_hero_images(session: AdminDep, db: DbSession):
    return [HeroImageOut.model_validate(h) for h in await svc.list_hero_images(db)]


@router.post("/hero-images", response_model=HeroImageOut)
async def upload_hero_image(
    session: AdminDep, db: DbSession, slot: int = Form(...), file: UploadFile = File(...)
):
    if not 1 <= slot <= 5:
        raise HTTPException(status_code=400, detail="Hero slot must be between 1 and 5.")

    content = await file.read()
    try:
        ext = validate_image(file.filename or "", content, file.content_type)
        url = save_image(hero_image_key(slot, ext), content, file.content_type)
    except ImageRejected as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    entry = await svc.set_hero_image(db, slot, cache_busted(url))
    return HeroImageOut.model_validate(entry)


# --- Bulk import ------------------------------------------------------------


@router.post("/products/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_import(
    session: AdminDep,
    db: DbSession,
    category_slug: str = Form(..., alias="categorySlug"),
    products_text: str = Form(..., alias="productsText"),
    images: list[UploadFile] = File(default=[]),
):
    """Atomic import: the whole batch is validated before anything is written,
    so a partial catalog can never result from one bad line."""
    errors: list[dict] = []

    if not category_slug.strip():
        errors.append({"lineNumber": None, "message": "A category must be selected."})
    elif await svc.get_category(db, category_slug) is None:
        errors.append({"lineNumber": None, "message": f'Unknown category "{category_slug}".'})

    parsed = bulk.parse_bulk_text(products_text)
    errors += [{"lineNumber": e.line_number, "message": e.message} for e in parsed.errors]

    uploads = [f for f in images if f.filename]
    contents: dict[str, bytes] = {}
    for upload in uploads:
        contents[upload.filename] = await upload.read()

    by_number, image_errors = bulk.match_images([f.filename for f in uploads], parsed.rows)
    errors += [{"lineNumber": e.line_number, "message": e.message} for e in image_errors]

    if parsed.rows:
        collisions = await bulk.check_part_number_collisions(db, parsed.rows)
        errors += [{"lineNumber": e.line_number, "message": e.message} for e in collisions]

    for filename in by_number.values():
        try:
            validate_image(filename, contents.get(filename, b""), None)
        except ImageRejected as exc:
            errors.append({"lineNumber": None, "message": f'Image "{filename}": {exc}'})

    if errors:
        return JSONResponse(status_code=400, content={"errors": errors})

    # Validation passed — persist images, then rows.
    image_paths: dict[int, str] = {}
    for line_number, filename in by_number.items():
        ext = Path(safe_filename(filename)).suffix.lower()
        key = product_image_key(category_slug, f"line-{line_number}{ext}")
        image_paths[line_number] = save_image(key, contents[filename])

    created = await bulk.commit_bulk_import(db, category_slug, parsed.rows, image_paths)
    return {
        "products": [ProductOut.model_validate(p).model_dump(by_alias=True) for p in created],
        "imported": len(created),
    }
