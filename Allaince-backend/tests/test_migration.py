import json
from pathlib import Path

import pytest
from sqlalchemy import select

from app.core.security import verify_password
from app.models import Category, Employee, OrderConfirmation, Product, Quotation


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    (tmp_path / "categories.json").write_text(
        json.dumps([{"slug": "plc", "name": "PLC", "icon": "/i.svg", "productCount": 99}])
    )
    (tmp_path / "products.json").write_text(
        json.dumps(
            [
                {
                    "slug": "p1", "partNumber": "PN-1", "name": "Widget",
                    "brand": "siemens", "categorySlug": "plc", "image": "/a.jpg",
                    "gallery": ["/a.jpg"], "shortSpecs": ["24V"], "description": ["d"],
                    "alternatePartNumbers": [], "specifications": {"V": "24"},
                    "price": 10.0, "stock": "in-stock", "stockQty": 0, "warrantyYears": 2,
                }
            ]
        )
    )
    (tmp_path / "employees.json").write_text(
        json.dumps(
            [
                {
                    "id": "emp-1", "employeeIdNumber": "EMP-1", "name": "Staff",
                    "email": "Staff@Example.com", "password": "plaintext123",
                    "designation": "support-agent", "createdAt": "2026-08-15T10:58:22.180Z",
                }
            ]
        )
    )
    (tmp_path / "quotations.json").write_text(
        json.dumps(
            [
                {
                    "id": "q-1", "items": [], "total": 5.0, "status": "confirmed",
                    "details": {"email": "Buyer@X.com", "submittedAt": "2026-08-01T00:00:00Z"},
                    "confirmation": {
                        "refNumber": "AIT/X/Q-0001/2026", "subject": "s",
                        "issuedDate": "2026-08-02", "trackingId": "AIT-TRK-1",
                        "lines": [], "grandTotal": 5.0, "terms": {},
                        "issuedAt": "2026-08-02T00:00:00Z",
                    },
                },
                {
                    "id": "q-2", "items": [], "total": 1.0, "status": "cancelled",
                    "details": {"email": "b@x.com", "submittedAt": "2026-08-01T00:00:00Z"},
                    # A cancelled quotation must not carry a live confirmation.
                    "confirmation": {
                        "refNumber": "STALE", "issuedDate": "2026-08-02",
                        "trackingId": "AIT-TRK-STALE", "lines": [], "grandTotal": 1.0,
                        "terms": {}, "issuedAt": "2026-08-02T00:00:00Z",
                    },
                },
            ]
        )
    )
    (tmp_path / "tasks.json").write_text(
        json.dumps(
            [
                {
                    "id": "t-1", "title": "Orphan", "description": "",
                    # References an employee that does not exist.
                    "assigneeEmployeeId": "ghost", "dueDate": "2026-09-01",
                    "status": "pending", "createdAt": "2026-08-15T00:00:00Z",
                }
            ]
        )
    )
    return tmp_path


async def _run(db, data_dir, monkeypatch):
    import scripts.migrate_json as script
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def _factory():
        yield db

    monkeypatch.setattr(script, "async_session_factory", _factory)
    return await script.migrate(data_dir)


async def test_migration_hashes_plaintext_passwords(db, data_dir, monkeypatch):
    await _run(db, data_dir, monkeypatch)
    employee = (await db.execute(select(Employee))).scalar_one()
    # No plaintext credential survives the move.
    assert employee.password_hash != "plaintext123"
    assert verify_password("plaintext123", employee.password_hash)
    assert employee.email == "staff@example.com"


async def test_migration_rederives_stock_status(db, data_dir, monkeypatch):
    await _run(db, data_dir, monkeypatch)
    product = (await db.execute(select(Product))).scalar_one()
    # The file claimed "in-stock" with a qty of 0; the derived value wins.
    assert product.stock_qty == 0
    assert product.stock == "out-of-stock"


async def test_migration_recomputes_category_counts(db, data_dir, monkeypatch):
    await _run(db, data_dir, monkeypatch)
    category = (await db.execute(select(Category))).scalar_one()
    # The file claimed 99; only one product actually exists.
    assert category.product_count == 1


async def test_migration_drops_confirmations_on_unconfirmed_quotations(db, data_dir, monkeypatch):
    await _run(db, data_dir, monkeypatch)
    confirmations = (await db.execute(select(OrderConfirmation))).scalars().all()
    assert len(confirmations) == 1
    assert confirmations[0].ref_number == "AIT/X/Q-0001/2026"


async def test_migration_denormalises_customer_email(db, data_dir, monkeypatch):
    await _run(db, data_dir, monkeypatch)
    quotation = (
        await db.execute(select(Quotation).where(Quotation.id == "q-1"))
    ).scalar_one()
    assert quotation.customer_email == "buyer@x.com"


async def test_migration_nulls_unknown_task_assignees(db, data_dir, monkeypatch):
    from app.models import Task

    await _run(db, data_dir, monkeypatch)
    task = (await db.execute(select(Task))).scalar_one()
    # An unknown assignee must not break the foreign key.
    assert task.assignee_employee_id is None


async def test_migration_refuses_to_run_twice(db, data_dir, monkeypatch, capsys):
    await _run(db, data_dir, monkeypatch)
    counts = await _run(db, data_dir, monkeypatch)
    assert counts == {}
    assert "already holds" in capsys.readouterr().out
