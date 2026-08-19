from datetime import datetime, timezone

from app.models import Category, Order, Product, Quotation
from app.schemas.session import AdminSession
from app.services.search import search_admin

SUPER = AdminSession(role="super", name="Ada", email="ada@x.com")
SUB_NO_GRANTS = AdminSession(role="sub", name="Bea", email="bea@x.com", employee_id="emp-1")
SUB_ORDERS = AdminSession(
    role="sub", name="Bea", email="bea@x.com", employee_id="emp-1", access_options=["orders"]
)


async def _seed(db):
    db.add(Category(slug="plc", name="PLC"))
    await db.flush()
    db.add(
        Product(
            slug="siemens-drive", part_number="6ES7-214", name="Siemens Drive",
            brand="siemens", category_slug="plc",
        )
    )
    db.add(
        Order(
            order_number="AIT-ORD-ABC123", tracking_id="AIT-TRK-XYZ", items=[],
            subtotal=0, grand_total=0, address={"name": "Ada Lovelace"},
            customer_name="Ada Lovelace", status="pending",
        )
    )
    db.add(
        Quotation(
            items=[], total=0,
            details={
                "fullName": "Grace Hopper",
                "email": "grace@navy.mil",
                "companyName": "Mahir Fabrics Ltd",
            },
            customer_email="grace@navy.mil",
            submitted_at=datetime.now(timezone.utc),
        )
    )
    await db.commit()


async def test_short_queries_return_nothing(db):
    await _seed(db)
    assert await search_admin(db, "a", SUPER) == []
    assert await search_admin(db, "", SUPER) == []


async def test_finds_product_by_name_part_number_and_brand(db):
    await _seed(db)
    for query in ("siemens", "6es7", "drive"):
        results = await search_admin(db, query, SUPER)
        assert any(r.type == "product" for r in results), query


async def test_finds_order_by_number_tracking_and_customer(db):
    await _seed(db)
    for query in ("abc123", "trk-xyz", "lovelace"):
        results = await search_admin(db, query, SUPER)
        assert any(r.type == "order" for r in results), query


async def test_finds_quotation_and_derived_client(db):
    await _seed(db)
    results = await search_admin(db, "grace", SUPER)
    assert any(r.type == "quotation" for r in results)
    assert any(r.type == "client" for r in results)


async def test_sub_admin_without_grants_sees_products_only(db):
    await _seed(db)
    # Products are open to any admin; operational records are gated.
    assert [r.type for r in await search_admin(db, "siemens", SUB_NO_GRANTS)] == ["product"]
    assert await search_admin(db, "lovelace", SUB_NO_GRANTS) == []
    assert await search_admin(db, "grace", SUB_NO_GRANTS) == []


async def test_sub_admin_with_orders_grant_sees_orders_not_quotations(db):
    await _seed(db)
    assert any(r.type == "order" for r in await search_admin(db, "lovelace", SUB_ORDERS))
    # No quotations grant, so neither quotations nor derived clients appear.
    assert await search_admin(db, "grace", SUB_ORDERS) == []


async def test_results_are_capped_per_type(db):
    db.add(Category(slug="plc", name="PLC"))
    await db.flush()
    for i in range(12):
        db.add(
            Product(
                slug=f"widget-{i}", part_number=f"PN-{i}", name=f"Widget {i}",
                brand="acme", category_slug="plc",
            )
        )
    await db.commit()

    results = await search_admin(db, "widget", SUPER)
    # One noisy category must not crowd out the others.
    assert len([r for r in results if r.type == "product"]) == 5


async def test_client_results_dedupe_by_email(db):
    for _ in range(3):
        db.add(
            Quotation(
                items=[], total=0,
                details={"fullName": "Grace", "email": "grace@navy.mil", "companyName": "Navy"},
                customer_email="grace@navy.mil",
                submitted_at=datetime.now(timezone.utc),
            )
        )
    await db.commit()

    clients = [r for r in await search_admin(db, "grace", SUPER) if r.type == "client"]
    assert len(clients) == 1


async def test_search_is_case_insensitive(db):
    await _seed(db)
    assert await search_admin(db, "SIEMENS", SUPER)
    assert await search_admin(db, "LoVeLaCe", SUPER)
