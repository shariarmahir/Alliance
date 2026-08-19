from sqlalchemy import inspect, select

from app.models import Base, Category, Employee, OrderConfirmation, Product, Quotation


async def test_all_tables_created(engine):
    async with engine.connect() as conn:
        names = await conn.run_sync(lambda c: inspect(c).get_table_names())
    assert {
        "categories", "brands", "products", "hero_images",
        "employees", "tasks", "leave_requests", "daily_reports",
        "quotations", "order_confirmations", "orders", "contact_requests", "gmail_token",
    } <= set(names)


async def test_json_columns_round_trip(db):
    db.add(Category(slug="plc", name="PLC"))
    await db.flush()
    db.add(
        Product(
            slug="p-1", part_number="PN-1", name="Widget", brand="siemens",
            category_slug="plc", gallery=["/a.jpg", "/b.jpg"],
            short_specs=["24V"], description=["Line one"],
            alternate_part_numbers=["ALT-1"],
            specifications={"Voltage": "24V", "Type": "Digital"},
            price=99.5, stock="in-stock", stock_qty=12, warranty_years=2,
        )
    )
    await db.commit()

    product = (await db.execute(select(Product).where(Product.slug == "p-1"))).scalar_one()
    assert product.gallery == ["/a.jpg", "/b.jpg"]
    assert product.specifications == {"Voltage": "24V", "Type": "Digital"}


async def test_confirmation_is_deleted_with_its_quotation(db):
    quotation = Quotation(id="q-1", items=[], total=0, details={"email": "a@b.com"})
    db.add(quotation)
    await db.flush()
    db.add(
        OrderConfirmation(
            quotation_id="q-1", ref_number="AIT/Q-1/2026", issued_date="2026-08-19",
            tracking_id="TRK-1", lines=[], grand_total=0, terms={},
        )
    )
    await db.commit()

    # Retraction is modelled as removing the row, not nulling fields.
    quotation.confirmation = None
    await db.commit()
    remaining = (await db.execute(select(OrderConfirmation))).scalars().all()
    assert remaining == []


async def test_employee_email_is_unique(db):
    import sqlalchemy.exc

    db.add(Employee(employee_id_number="EMP-1", name="A", email="dup@x.com", password_hash="h"))
    await db.commit()
    db.add(Employee(employee_id_number="EMP-2", name="B", email="dup@x.com", password_hash="h"))
    try:
        await db.commit()
        raise AssertionError("expected a unique-constraint violation")
    except sqlalchemy.exc.IntegrityError:
        await db.rollback()
