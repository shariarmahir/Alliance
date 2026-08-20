"""Manual check: exercise the PDF endpoints over HTTP against a live DB.

Usage (from Allaince-backend/):
    python -m scripts.verify_pdf_endpoint
"""

import asyncio
import base64
import logging
import os

import bcrypt

logging.disable(logging.CRITICAL)

PASSWORD = "VerifyPdf123"
os.environ.setdefault("SUPER_ADMIN_EMAIL", "pdfcheck@autolink.com")
os.environ.setdefault(
    "SUPER_ADMIN_PASSWORD_HASH_B64",
    base64.b64encode(bcrypt.hashpw(PASSWORD.encode(), bcrypt.gensalt(12))).decode(),
)

from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Base  # noqa: E402

settings.super_admin_email = os.environ["SUPER_ADMIN_EMAIL"]
settings.super_admin_password_hash_b64 = os.environ["SUPER_ADMIN_PASSWORD_HASH_B64"]

QUOTE = {
    "items": [
        {
            "slug": "drive-x",
            "partNumber": "PN-A",
            "name": "Siemens Drive X",
            "brand": "siemens",
            "image": "/i.jpg",
            "price": 50000.0,
            "quantity": 4,
        }
    ],
    "details": {
        "fullName": "Grace Hopper",
        "email": "grace@navy.mil",
        "phone": "+8801700000000",
        "companyName": "Mahir Fabrics Ltd",
        "country": "Bangladesh",
        "preferredContact": "email",
        "leadTime": "urgent",
        "notes": "Verification run",
    },
}


async def main() -> None:
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
    from sqlalchemy.pool import StaticPool

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async def override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
        created = await client.post("/api/quotations", json=QUOTE)
        quotation_id = created.json()["id"]
        print(f"  quotation submitted        [{created.status_code}] total={created.json()['total']}")

        login = await client.post(
            "/api/admin/login",
            json={"email": settings.super_admin_email, "password": PASSWORD},
        )
        print(f"  admin logged in            [{login.status_code}]")

        # Before confirmation: the un-priced request document.
        unpriced = await client.get(f"/api/admin/quotations/{quotation_id}/pdf")
        _report("unpriced request PDF", unpriced)

        confirmed = await client.post(
            f"/api/admin/quotations/{quotation_id}/confirm",
            json={
                "subject": "Financial Offer for supply of Siemens Drive X",
                "lines": [
                    {
                        "name": "Siemens Drive X",
                        "partNumber": "PN-A",
                        "slug": "drive-x",
                        "specifications": "400V 3-phase, IP55",
                        "quantity": 4,
                        "unit": "Pcs",
                        "unitPrice": 52500.0,
                    }
                ],
            },
        )
        ref = confirmed.json()["confirmation"]["refNumber"]
        print(f"  confirmation issued        [{confirmed.status_code}] ref={ref}")

        issued = await client.get(f"/api/admin/quotations/{quotation_id}/pdf")
        _report("issued quotation PDF", issued)

        order = await client.post(
            "/api/orders",
            json={
                "items": QUOTE["items"],
                "subtotal": 200000.0,
                "shippingCost": 2500.0,
                "grandTotal": 202500.0,
                "deliveryOption": "express",
                "deliveryOptionName": "Express",
                "deliveryEta": "2-3 days",
                "preferredDate": "2026-09-01",
                "address": {
                    "name": "Grace Hopper",
                    "line": "House 104",
                    "city": "Dhaka",
                    "country": "Bangladesh",
                    "phone": "+8801700000000",
                },
            },
        )
        order_number = order.json()["orderNumber"]
        invoice = await client.get(f"/api/admin/orders/{order_number}/invoice")
        _report("order invoice PDF", invoice)

    await engine.dispose()
    app.dependency_overrides.clear()


def _report(label: str, response) -> None:
    body = response.content
    ok = response.status_code == 200 and body.startswith(b"%PDF-")
    disposition = response.headers.get("content-disposition", "")
    status = "OK " if ok else "ERR"
    detail = (
        f"{len(body):,} bytes  {response.headers.get('content-type')}  {disposition}"
        if ok
        else body[:200]
    )
    print(f"  {status} {label:<24} [{response.status_code}] {detail}")


if __name__ == "__main__":
    asyncio.run(main())
