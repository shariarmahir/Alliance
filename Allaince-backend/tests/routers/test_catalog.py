import io

from app.core.session_token import ADMIN_SESSION_COOKIE, create_session_token
from app.models import Category, Employee, Product
from app.schemas.session import AdminSession

PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
    b"\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05"
    b"\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _auth(client, role="super", **kwargs):
    client.cookies.set(
        ADMIN_SESSION_COOKIE,
        create_session_token(AdminSession(role=role, name="A", email="a@x.com", **kwargs)),
    )


async def _seed_sub_admin(db, employee_id="emp-1"):
    """require_admin re-checks that a token's employee still exists, so a
    sub-admin session needs a real row behind it or it reads as deleted."""
    db.add(
        Employee(
            id=employee_id, employee_id_number=employee_id, name="Sub", email=f"{employee_id}@x.com",
            password_hash="x", role="sub", access_options=[],
        )
    )
    await db.commit()


async def _seed(db):
    db.add(Category(slug="plc", name="PLC"))
    await db.flush()
    db.add(
        Product(
            slug="widget", part_number="PN-1", name="Widget", brand="siemens",
            category_slug="plc", price=10.0, stock="in-stock", stock_qty=25,
        )
    )
    await db.commit()


# --- public reads -----------------------------------------------------------


async def test_public_product_list_and_detail(client, db):
    await _seed(db)
    listed = await client.get("/api/products")
    assert listed.status_code == 200 and listed.json()["total"] == 1

    detail = await client.get("/api/products/widget")
    assert detail.status_code == 200
    body = detail.json()
    assert body["partNumber"] == "PN-1"
    assert body["stockQty"] == 25


async def test_unknown_product_is_404(client):
    assert (await client.get("/api/products/nope")).status_code == 404


async def test_public_filters(client, db):
    await _seed(db)
    assert (await client.get("/api/products?category=plc")).json()["total"] == 1
    assert (await client.get("/api/products?category=servo")).json()["total"] == 0
    assert (await client.get("/api/products?q=widget")).json()["total"] == 1
    assert (await client.get("/api/products?brand=siemens")).json()["total"] == 1


async def test_page_size_is_capped(client, db):
    await _seed(db)
    # An unbounded page size would let anyone dump the catalog in one request.
    assert (await client.get("/api/products?pageSize=5000")).status_code == 422


# --- admin writes -----------------------------------------------------------


async def test_catalog_writes_require_authentication(client):
    assert (await client.post("/api/admin/products", json={})).status_code == 401
    assert (await client.get("/api/admin/products")).status_code == 401


async def test_sub_admin_may_manage_catalog(client, db):
    await _seed(db)
    await _seed_sub_admin(db)
    # Catalog is open to any authenticated admin, unlike operations.
    _auth(client, role="sub", employee_id="emp-1")
    assert (await client.get("/api/admin/products")).status_code == 200
    r = await client.patch("/api/admin/products/widget/stock", json={"stockQty": 3})
    assert r.status_code == 200 and r.json()["stock"] == "low-stock"


async def test_create_product_rejects_unknown_category(client):
    _auth(client)
    r = await client.post(
        "/api/admin/products",
        json={"name": "X", "partNumber": "PN-X", "brand": "b", "categorySlug": "ghost"},
    )
    assert r.status_code == 400


async def test_duplicate_part_number_is_rejected(client, db):
    await _seed(db)
    _auth(client)
    r = await client.post(
        "/api/admin/products",
        json={"name": "Other", "partNumber": "PN-1", "brand": "b", "categorySlug": "plc"},
    )
    assert r.status_code == 409


async def test_stock_status_cannot_be_set_directly(client, db):
    await _seed(db)
    _auth(client)
    # "stock" is not an accepted field; it is always derived from stockQty.
    r = await client.patch("/api/admin/products/widget", json={"stock": "out-of-stock"})
    assert r.status_code == 200
    assert r.json()["stock"] == "in-stock"


async def test_delete_product_updates_category_count(client, db):
    await _seed(db)
    _auth(client)
    assert (await client.delete("/api/admin/products/widget")).status_code == 204
    categories = (await client.get("/api/admin/categories")).json()
    assert categories[0]["productCount"] == 0


async def test_create_category_slugifies_name(client):
    _auth(client)
    r = await client.post("/api/admin/categories", json={"name": "Servo & Motion!"})
    assert r.status_code == 201 and r.json()["slug"] == "servo-motion"


async def test_rename_category_keeps_the_slug(client, db):
    # The slug is the products' foreign key and appears in storefront URLs, so
    # a rename must change the label only.
    await _seed(db)
    _auth(client)
    r = await client.patch("/api/admin/categories/plc", json={"name": "PLCs & Controllers"})
    assert r.status_code == 200
    assert r.json() == {**r.json(), "slug": "plc", "name": "PLCs & Controllers"}
    # The product still resolves through the unchanged slug.
    assert (await client.get("/api/products/widget")).json()["categorySlug"] == "plc"


async def test_rename_unknown_category_is_404(client):
    _auth(client)
    assert (
        await client.patch("/api/admin/categories/nope", json={"name": "X"})
    ).status_code == 404


async def test_delete_category_refuses_while_products_reference_it(client, db):
    await _seed(db)
    _auth(client)
    r = await client.delete("/api/admin/categories/plc")
    assert r.status_code == 409
    assert "1 product" in r.json()["detail"]
    # Still there, and still usable.
    assert (await client.get("/api/products/widget")).status_code == 200


async def test_delete_empty_category(client, db):
    await _seed(db)
    _auth(client)
    assert (await client.delete("/api/admin/products/widget")).status_code == 204
    assert (await client.delete("/api/admin/categories/plc")).status_code == 204
    assert (await client.get("/api/categories")).json() == []


async def test_category_writes_require_authentication(client, db):
    await _seed(db)
    assert (
        await client.patch("/api/admin/categories/plc", json={"name": "X"})
    ).status_code == 401
    assert (await client.delete("/api/admin/categories/plc")).status_code == 401


# --- brands -------------------------------------------------------------


async def test_create_brand_slugifies_name(client):
    _auth(client)
    r = await client.post("/api/admin/brands", json={"name": "Siemens AG!"})
    assert r.status_code == 201
    assert r.json()["slug"] == "siemens-ag"
    assert r.json()["productCount"] == 0


async def test_admin_brand_list_reports_product_count(client, db):
    await _seed(db)
    _auth(client)
    r = await client.post("/api/admin/brands", json={"name": "siemens"})
    assert r.status_code == 201
    listed = (await client.get("/api/admin/brands")).json()
    siemens = next(b for b in listed if b["slug"] == r.json()["slug"])
    assert siemens["productCount"] == 1


async def test_rename_brand_cascades_to_its_products(client, db):
    # Unlike a category, a brand's name is copied directly onto every product
    # row (there is no foreign key), so a rename must update them too or the
    # products silently fall off the renamed brand.
    await _seed(db)
    _auth(client)
    created = await client.post("/api/admin/brands", json={"name": "siemens"})
    slug = created.json()["slug"]

    r = await client.patch(f"/api/admin/brands/{slug}", json={"name": "Siemens AG"})
    assert r.status_code == 200
    assert r.json()["slug"] == slug
    assert r.json()["name"] == "Siemens AG"

    product = (await client.get("/api/products/widget")).json()
    assert product["brand"] == "Siemens AG"


async def test_rename_unknown_brand_is_404(client):
    _auth(client)
    assert (
        await client.patch("/api/admin/brands/nope", json={"name": "X"})
    ).status_code == 404


async def test_delete_brand_refuses_while_products_reference_it(client, db):
    await _seed(db)
    _auth(client)
    created = await client.post("/api/admin/brands", json={"name": "siemens"})
    slug = created.json()["slug"]

    r = await client.delete(f"/api/admin/brands/{slug}")
    assert r.status_code == 409
    assert "1 product" in r.json()["detail"]


async def test_delete_empty_brand(client, db):
    _auth(client)
    created = await client.post("/api/admin/brands", json={"name": "Omron"})
    slug = created.json()["slug"]
    assert (await client.delete(f"/api/admin/brands/{slug}")).status_code == 204
    assert not any(b["slug"] == slug for b in (await client.get("/api/brands")).json())


async def test_brand_writes_require_authentication(client, db):
    assert (await client.post("/api/admin/brands", json={"name": "X"})).status_code == 401
    assert (await client.get("/api/admin/brands")).status_code == 401


async def test_public_brand_list_omits_product_count(client, db):
    # The storefront brand strip has no use for the count, and it costs a
    # query per brand to compute, so the public schema leaves it out.
    _auth(client)
    await client.post("/api/admin/brands", json={"name": "Omron"})
    listed = (await client.get("/api/brands")).json()
    assert listed and "productCount" not in listed[0]


# --- uploads ----------------------------------------------------------------


async def test_brand_logo_upload(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    _auth(client)
    created = await client.post("/api/admin/brands", json={"name": "Omron"})
    slug = created.json()["slug"]
    r = await client.post(
        f"/api/admin/brands/{slug}/logo",
        files={"file": ("logo.png", io.BytesIO(PNG), "image/png")},
    )
    assert r.status_code == 200
    assert r.json()["logo"].endswith(".png")


async def test_product_image_upload(client, db, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    await _seed(db)
    _auth(client)
    r = await client.post(
        "/api/admin/products/widget/image",
        files={"file": ("photo.png", io.BytesIO(PNG), "image/png")},
    )
    assert r.status_code == 200
    assert r.json()["image"].endswith(".png")


async def test_uploaded_product_image_is_actually_servable(client, db, tmp_path, monkeypatch):
    """The upload endpoint returning 200 with a plausible-looking URL is not
    proof the image is visible anywhere — this is exactly the gap that let a
    real dashboard upload 404 in production while every test still passed.
    /media was never mounted, so save_image() wrote the file to disk and
    handed back a URL nothing served. Fetch the URL back through this app's
    own router, the way a browser img tag would, rather than trusting the
    response shape."""
    monkeypatch.chdir(tmp_path)
    await _seed(db)
    _auth(client)
    upload = await client.post(
        "/api/admin/products/widget/image",
        files={"file": ("photo.png", io.BytesIO(PNG), "image/png")},
    )
    image_url = upload.json()["image"]
    path = "/" + image_url.split("/", 3)[-1] if "://" in image_url else image_url
    served = await client.get(path)
    assert served.status_code == 200
    assert served.content == PNG


async def test_gallery_upload_appends_behind_the_main_image(client, db, tmp_path, monkeypatch):
    """The main photo leads the gallery and the extras follow, which is the
    order the product page renders the thumbnail strip in."""
    monkeypatch.chdir(tmp_path)
    await _seed(db)
    _auth(client)

    main = await client.post(
        "/api/admin/products/widget/image",
        files={"file": ("photo.png", io.BytesIO(PNG), "image/png")},
    )
    main_url = main.json()["image"]

    r = await client.post(
        "/api/admin/products/widget/gallery",
        files=[
            ("files", ("a.png", io.BytesIO(PNG), "image/png")),
            ("files", ("b.png", io.BytesIO(PNG), "image/png")),
        ],
    )
    assert r.status_code == 200
    gallery = r.json()["gallery"]
    assert gallery[0] == main_url
    assert len(gallery) == 3
    # Distinct keys: sharing one would mean each upload overwrote the last.
    assert len(set(gallery)) == 3


async def test_uploaded_gallery_images_are_actually_servable(client, db, tmp_path, monkeypatch):
    """Same reasoning as the main-image test: a 200 with a plausible URL is
    not proof a browser can load it."""
    monkeypatch.chdir(tmp_path)
    await _seed(db)
    _auth(client)

    r = await client.post(
        "/api/admin/products/widget/gallery",
        files=[("files", ("a.png", io.BytesIO(PNG), "image/png"))],
    )
    url = r.json()["gallery"][-1]
    path = "/" + url.split("/", 3)[-1] if "://" in url else url
    served = await client.get(path)
    assert served.status_code == 200
    assert served.content == PNG


async def test_gallery_upload_is_additive(client, db, tmp_path, monkeypatch):
    """Uploading one more shot must not wipe the ones already there."""
    monkeypatch.chdir(tmp_path)
    await _seed(db)
    _auth(client)

    await client.post(
        "/api/admin/products/widget/gallery",
        files=[("files", ("a.png", io.BytesIO(PNG), "image/png"))],
    )
    r = await client.post(
        "/api/admin/products/widget/gallery",
        files=[("files", ("b.png", io.BytesIO(PNG), "image/png"))],
    )
    assert len(r.json()["gallery"]) == 2


async def test_replacing_the_main_image_keeps_the_gallery(client, db, tmp_path, monkeypatch):
    """The main-image route used to overwrite `gallery` with a single-item
    list, so re-uploading the primary photo discarded every extra shot."""
    monkeypatch.chdir(tmp_path)
    await _seed(db)
    _auth(client)

    await client.post(
        "/api/admin/products/widget/gallery",
        files=[("files", ("a.png", io.BytesIO(PNG), "image/png"))],
    )
    r = await client.post(
        "/api/admin/products/widget/image",
        files={"file": ("new.png", io.BytesIO(PNG), "image/png")},
    )
    gallery = r.json()["gallery"]
    assert gallery[0] == r.json()["image"]
    assert len(gallery) == 2


async def test_gallery_is_capped(client, db, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    await _seed(db)
    _auth(client)
    r = await client.post(
        "/api/admin/products/widget/gallery",
        files=[
            ("files", (f"{n}.png", io.BytesIO(PNG), "image/png")) for n in range(4)
        ],
    )
    assert r.status_code == 400


async def test_gallery_upload_rejects_non_image(client, db, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    await _seed(db)
    _auth(client)
    r = await client.post(
        "/api/admin/products/widget/gallery",
        files=[("files", ("payload.exe", io.BytesIO(b"MZ..."), "application/octet-stream"))],
    )
    assert r.status_code == 400


async def test_gallery_upload_requires_authentication(client, db):
    await _seed(db)
    r = await client.post(
        "/api/admin/products/widget/gallery",
        files=[("files", ("a.png", io.BytesIO(PNG), "image/png"))],
    )
    assert r.status_code == 401


async def test_upload_rejects_non_image(client, db, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    await _seed(db)
    _auth(client)
    r = await client.post(
        "/api/admin/products/widget/image",
        files={"file": ("payload.exe", io.BytesIO(b"MZ..."), "application/octet-stream")},
    )
    assert r.status_code == 400


async def test_upload_rejects_empty_file(client, db, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    await _seed(db)
    _auth(client)
    r = await client.post(
        "/api/admin/products/widget/image",
        files={"file": ("empty.png", io.BytesIO(b""), "image/png")},
    )
    assert r.status_code == 400


async def test_hero_slot_is_bounded(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    _auth(client)
    r = await client.post(
        "/api/admin/hero-images",
        data={"slot": "9"},
        files={"file": ("h.png", io.BytesIO(PNG), "image/png")},
    )
    assert r.status_code == 400


async def test_hero_upload_replaces_slot_and_cache_busts(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    _auth(client)
    first = await client.post(
        "/api/admin/hero-images",
        data={"slot": "1"},
        files={"file": ("h.png", io.BytesIO(PNG), "image/png")},
    )
    assert first.status_code == 200
    assert "?v=" in first.json()["path"]

    listed = (await client.get("/api/hero-images")).json()
    assert len(listed) == 1 and listed[0]["slot"] == 1


# --- bulk import ------------------------------------------------------------


async def test_bulk_import_happy_path(client, db, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    db.add(Category(slug="plc", name="PLC"))
    await db.commit()
    _auth(client)

    r = await client.post(
        "/api/admin/products/bulk",
        data={
            "categorySlug": "plc",
            "productsText": "1. Alpha Drive | PN-A1 | 120.50 | 24V, DIN | in-stock",
        },
        files=[("images", ("1.png", io.BytesIO(PNG), "image/png"))],
    )
    assert r.status_code == 201
    assert r.json()["imported"] == 1
    assert r.json()["products"][0]["slug"] == "alpha-drive"


async def test_bulk_import_is_atomic_on_error(client, db, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    db.add(Category(slug="plc", name="PLC"))
    await db.commit()
    _auth(client)

    r = await client.post(
        "/api/admin/products/bulk",
        data={
            "categorySlug": "plc",
            # Second line is malformed; the first must not be written either.
            "productsText": "1. Alpha | PN-A | 10 | s | in-stock\n2. Broken | PN-B | oops",
        },
        files=[("images", ("1.png", io.BytesIO(PNG), "image/png"))],
    )
    assert r.status_code == 400
    assert r.json()["errors"]
    assert (await client.get("/api/products")).json()["total"] == 0


async def test_bulk_import_rejects_unknown_category(client, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    _auth(client)
    r = await client.post(
        "/api/admin/products/bulk",
        data={"categorySlug": "ghost", "productsText": "1. A | PN | 1 | s | in-stock"},
        files=[("images", ("1.png", io.BytesIO(PNG), "image/png"))],
    )
    assert r.status_code == 400
