"""One-time seed: reads Alliance-frontend/data/*.json into Postgres.

Runs through the ORM (not raw SQL) so derivation and hashing apply on the way
in — stock status is re-derived, and any legacy plaintext password is hashed,
so no plaintext credential survives the move.

Usage (from Allaince-backend/):
    python -m scripts.migrate_json                    # default ../Alliance-frontend/data
    python -m scripts.migrate_json --data-dir PATH
    python -m scripts.migrate_json --dry-run
"""

import argparse
import asyncio
import json
from datetime import date, datetime, timezone
from pathlib import Path

from sqlalchemy import func, select

from app.core.security import hash_password, is_hashed
from app.db import async_session_factory, engine
from app.models import (
    Base,
    Brand,
    Category,
    ContactRequest,
    DailyReport,
    Employee,
    HeroImage,
    LeaveRequest,
    Order,
    OrderConfirmation,
    Product,
    Quotation,
    Task,
)
from app.services.catalog import derive_stock_status, slugify

DEFAULT_DATA_DIR = Path("..") / "Alliance-frontend" / "data"


def _load(data_dir: Path, name: str) -> list | dict:
    path = data_dir / name
    if not path.exists():
        print(f"  - {name}: not found, skipping")
        return []
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def _parse_dt(value, fallback: datetime | None = None) -> datetime:
    if not value:
        return fallback or datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return fallback or datetime.now(timezone.utc)
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _parse_date(value) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


async def migrate(data_dir: Path, dry_run: bool = False) -> dict[str, int]:
    counts: dict[str, int] = {}

    async with async_session_factory() as db:
        existing = (await db.execute(select(func.count()).select_from(Product))).scalar_one()
        if existing:
            print(f"! Database already holds {existing} products.")
            print("  Re-running would duplicate rows. Aborting.")
            return {}

        # --- categories ---
        categories = _load(data_dir, "categories.json")
        for entry in categories:
            db.add(
                Category(
                    slug=entry["slug"],
                    name=entry["name"],
                    icon=entry.get("icon", ""),
                    product_count=0,  # recomputed after products land
                )
            )
        counts["categories"] = len(categories)
        await db.flush()

        # --- products (and the brands they imply) ---
        products = _load(data_dir, "products.json")
        seen_brands: set[str] = set()
        for entry in products:
            brand = entry.get("brand", "")
            if brand and brand not in seen_brands:
                seen_brands.add(brand)
                db.add(
                    Brand(slug=slugify(brand), name=brand.replace("-", " ").title())
                )
            stock_qty = int(entry.get("stockQty", 0))
            db.add(
                Product(
                    slug=entry["slug"],
                    part_number=entry["partNumber"],
                    name=entry["name"],
                    brand=brand,
                    category_slug=entry["categorySlug"],
                    image=entry.get("image", ""),
                    gallery=entry.get("gallery", []),
                    short_specs=entry.get("shortSpecs", []),
                    description=entry.get("description", []),
                    alternate_part_numbers=entry.get("alternatePartNumbers", []),
                    specifications=entry.get("specifications", {}),
                    price=float(entry.get("price", 0)),
                    # Re-derived rather than trusted, so a stale stored value
                    # cannot carry a wrong badge into the new system.
                    stock=derive_stock_status(stock_qty),
                    stock_qty=stock_qty,
                    warranty_years=int(entry.get("warrantyYears", 1)),
                )
            )
        counts["products"] = len(products)
        counts["brands"] = len(seen_brands)
        await db.flush()

        # Recompute the denormalized counts from what actually landed.
        product_counts = dict(
            (
                await db.execute(
                    select(Product.category_slug, func.count()).group_by(Product.category_slug)
                )
            ).all()
        )
        for category in (await db.execute(select(Category))).scalars().all():
            category.product_count = int(product_counts.get(category.slug, 0))

        # --- hero images ---
        hero = _load(data_dir, "hero-images.json")
        for entry in hero:
            db.add(HeroImage(slot=int(entry["slot"]), path=entry["path"]))
        counts["hero_images"] = len(hero)

        # --- employees ---
        employees = _load(data_dir, "employees.json")
        hashed_count = 0
        for entry in employees:
            stored = entry.get("password", "")
            if stored and not is_hashed(stored):
                stored = hash_password(stored)
                hashed_count += 1
            db.add(
                Employee(
                    id=entry["id"],
                    employee_id_number=entry.get("employeeIdNumber", entry["id"][:8]),
                    name=entry.get("name", ""),
                    email=entry["email"].strip().lower(),
                    password_hash=stored or hash_password("change-me-immediately"),
                    designation=entry.get("designation", "other"),
                    custom_designation=entry.get("customDesignation"),
                    role=entry.get("role", "sub"),
                    access_options=entry.get("accessOptions", []),
                    disabled=bool(entry.get("disabled", False)),
                    created_at=_parse_dt(entry.get("createdAt")),
                )
            )
        counts["employees"] = len(employees)
        if hashed_count:
            print(f"  * hashed {hashed_count} plaintext password(s) during migration")
        await db.flush()

        # --- quotations and their confirmations ---
        quotations = _load(data_dir, "quotations.json")
        confirmations = 0
        for entry in quotations:
            details = entry.get("details", {})
            submitted = _parse_dt(details.get("submittedAt"))
            db.add(
                Quotation(
                    id=entry["id"],
                    items=entry.get("items", []),
                    total=float(entry.get("total", 0)),
                    details=details,
                    status=entry.get("status", "pending"),
                    customer_email=(details.get("email") or "").strip().lower(),
                    submitted_at=submitted,
                )
            )
            confirmation = entry.get("confirmation")
            # Only a confirmed quotation may carry an issued document.
            if confirmation and entry.get("status") == "confirmed":
                db.add(
                    OrderConfirmation(
                        quotation_id=entry["id"],
                        ref_number=confirmation.get("refNumber", ""),
                        subject=confirmation.get("subject", ""),
                        issued_date=str(confirmation.get("issuedDate", ""))[:10],
                        tracking_id=confirmation.get("trackingId", ""),
                        lines=confirmation.get("lines", []),
                        grand_total=float(confirmation.get("grandTotal", 0)),
                        terms=confirmation.get("terms", {}),
                        issued_at=_parse_dt(confirmation.get("issuedAt"), submitted),
                        delivery_stage=int(confirmation.get("deliveryStage") or 0),
                        delivery_updated_at=(
                            _parse_dt(confirmation["deliveryUpdatedAt"])
                            if confirmation.get("deliveryUpdatedAt")
                            else None
                        ),
                    )
                )
                confirmations += 1
        counts["quotations"] = len(quotations)
        counts["order_confirmations"] = confirmations

        # --- orders ---
        orders = _load(data_dir, "orders.json")
        for entry in orders:
            address = entry.get("address", {})
            db.add(
                Order(
                    order_number=entry["orderNumber"],
                    tracking_id=entry.get("trackingId", ""),
                    items=entry.get("items", []),
                    subtotal=float(entry.get("subtotal", 0)),
                    shipping_cost=float(entry.get("shippingCost", 0)),
                    grand_total=float(entry.get("grandTotal", 0)),
                    delivery_option=entry.get("deliveryOption", "standard"),
                    delivery_option_name=entry.get("deliveryOptionName", ""),
                    delivery_eta=entry.get("deliveryEta", ""),
                    preferred_date=str(entry.get("preferredDate", ""))[:10],
                    address=address,
                    customer_name=(address.get("name") or "").strip(),
                    placed_at=_parse_dt(entry.get("placedAt")),
                    status=entry.get("status", "pending"),
                )
            )
        counts["orders"] = len(orders)

        # --- contact requests ---
        contacts = _load(data_dir, "contact-requests.json")
        for entry in contacts:
            db.add(
                ContactRequest(
                    id=entry["id"],
                    name=entry.get("name", ""),
                    email=entry.get("email", ""),
                    subject=entry.get("subject", ""),
                    message=entry.get("message", ""),
                    submitted_at=_parse_dt(entry.get("submittedAt")),
                    handled=bool(entry.get("handled", False)),
                )
            )
        counts["contact_requests"] = len(contacts)

        # --- tasks / leave / reports ---
        employee_ids = {
            row for row in (await db.execute(select(Employee.id))).scalars().all()
        }

        tasks = _load(data_dir, "tasks.json")
        for entry in tasks:
            assignee = entry.get("assigneeEmployeeId")
            db.add(
                Task(
                    id=entry["id"],
                    title=entry.get("title", ""),
                    description=entry.get("description", ""),
                    # Unknown assignees become NULL rather than breaking the FK.
                    assignee_employee_id=assignee if assignee in employee_ids else None,
                    due_date=_parse_date(entry.get("dueDate")),
                    status=entry.get("status", "pending"),
                    created_at=_parse_dt(entry.get("createdAt")),
                )
            )
        counts["tasks"] = len(tasks)

        leave = _load(data_dir, "leave-requests.json")
        for entry in leave:
            employee_id = entry.get("employeeId")
            db.add(
                LeaveRequest(
                    id=entry["id"],
                    employee_id=employee_id if employee_id in employee_ids else None,
                    start_date=_parse_date(entry.get("startDate")) or date.today(),
                    end_date=_parse_date(entry.get("endDate")) or date.today(),
                    reason=entry.get("reason", ""),
                    status=entry.get("status", "pending"),
                    submitted_at=_parse_dt(entry.get("submittedAt")),
                )
            )
        counts["leave_requests"] = len(leave)

        reports = _load(data_dir, "daily-reports.json")
        for entry in reports:
            employee_id = entry.get("employeeId")
            db.add(
                DailyReport(
                    id=entry["id"],
                    employee_id=employee_id if employee_id in employee_ids else None,
                    date=_parse_date(entry.get("date")) or date.today(),
                    hours_worked=float(entry.get("hoursWorked", 0)),
                    summary=entry.get("summary", ""),
                    submitted_at=_parse_dt(entry.get("submittedAt")),
                )
            )
        counts["daily_reports"] = len(reports)

        if dry_run:
            await db.rollback()
            print("\nDry run — nothing was written.")
        else:
            await db.commit()

    return counts


async def main() -> None:
    parser = argparse.ArgumentParser(description="Seed Postgres from the frontend JSON files.")
    parser.add_argument("--data-dir", type=Path, default=DEFAULT_DATA_DIR)
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing.")
    parser.add_argument(
        "--create-tables",
        action="store_true",
        help="Create tables first (dev only; production uses Alembic).",
    )
    args = parser.parse_args()

    data_dir = args.data_dir.resolve()
    if not data_dir.exists():
        raise SystemExit(f"Data directory not found: {data_dir}")

    print(f"Reading from {data_dir}\n")

    if args.create_tables:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    counts = await migrate(data_dir, dry_run=args.dry_run)
    if counts:
        print("\nMigrated:")
        for table, count in counts.items():
            print(f"  {table:22} {count}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
