"""Invoices and challans raised against a confirmed order.

Both documents share a shape: prepared as a draft, approved into a numbered
formal document, then progressed through a delivery or payment lifecycle. They
are kept in one module because the quantity arithmetic is the same idea on
both sides — how much of the order has been billed, and how much has shipped.

The balances are always derived by summing the document lines, never stored on
the order. A stored counter drifts the first time a document is cancelled or
edited, and a wrong balance here means over-shipping or double-billing a
customer.
"""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Challan,
    ChallanLine,
    Invoice,
    InvoiceLine,
    InvoicePayment,
    Quotation,
)
from app.models.base import business_today

# Statuses whose lines no longer count toward what has been billed or shipped.
# A cancelled document releases its quantities back to the balance.
VOID_STATUSES = ("cancelled",)

INVOICE_STATUSES = (
    "pending",
    "submitted",
    "partially_paid",
    "paid",
    "completed",
    "cancelled",
)
CHALLAN_STATUSES = ("pending", "dispatched", "delivered", "cancelled")


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _round(value: float) -> float:
    return round(value + 0.0, 2)


# ---------------------------------------------------------------------------
# Numbering
# ---------------------------------------------------------------------------


async def _next_sequence(db: AsyncSession, model, column) -> int:
    """Next number in a formal series.

    Counts only rows that actually hold a number, so drafts and cancelled
    documents never consume one — a gap in an invoice series is the kind of
    thing an auditor asks about.
    """
    total = await db.scalar(select(func.count()).select_from(model).where(column.isnot(None)))
    return int(total or 0) + 1


def _document_number(prefix: str, company_name: str, sequence: int, year: int) -> str:
    """Mirrors the quotation reference format so the whole document set reads
    as one series: AIT/<initials>/<prefix>-0001/<year>."""
    initials = "".join(word[0] for word in (company_name or "").split() if word)[:4].upper()
    return f"AIT/{initials or 'GEN'}/{prefix}-{sequence:04d}/{year}"


# ---------------------------------------------------------------------------
# Quantity control
# ---------------------------------------------------------------------------


def _ordered_quantities(quotation: Quotation) -> dict[str, dict]:
    """What the confirmed order actually commits to, keyed by product slug."""
    confirmation = quotation.confirmation
    if confirmation is None:
        return {}

    ordered: dict[str, dict] = {}
    for index, line in enumerate(confirmation.lines or []):
        slug = (line or {}).get("slug") or f"line-{index}"
        # A slug can legitimately repeat if the same part is quoted on two
        # lines, so quantities accumulate rather than overwrite.
        entry = ordered.setdefault(
            slug,
            {
                "slug": slug,
                "name": line.get("name") or "",
                "specifications": line.get("specifications") or "",
                "unit": line.get("unit") or "Pcs",
                "unitPrice": float(line.get("unitPrice") or 0),
                "ordered": 0,
                "position": index,
            },
        )
        entry["ordered"] += int(line.get("quantity") or 0)
    return ordered


async def _delivered_by_slug(db: AsyncSession, quotation_id: str) -> dict[str, int]:
    rows = await db.execute(
        select(ChallanLine.slug, func.sum(ChallanLine.quantity))
        .join(Challan, Challan.id == ChallanLine.challan_id)
        .where(
            Challan.quotation_id == quotation_id,
            Challan.status.notin_(VOID_STATUSES),
        )
        .group_by(ChallanLine.slug)
    )
    return {slug: int(total or 0) for slug, total in rows.all()}


async def _invoiced_by_slug(db: AsyncSession, quotation_id: str) -> dict[str, int]:
    rows = await db.execute(
        select(InvoiceLine.slug, func.sum(InvoiceLine.quantity))
        .join(Invoice, Invoice.id == InvoiceLine.invoice_id)
        .where(
            Invoice.quotation_id == quotation_id,
            Invoice.status.notin_(VOID_STATUSES),
        )
        .group_by(InvoiceLine.slug)
    )
    return {slug: int(total or 0) for slug, total in rows.all()}


async def order_balances(
    db: AsyncSession, quotation: Quotation, *, exclude_challan: str | None = None
) -> list[dict]:
    """Ordered / delivered / invoiced / balance per line.

    `exclude_challan` leaves one challan's own quantities out of the delivered
    figure, which is what makes editing a saved challan work: without it, the
    quantities already on the document being edited would count against their
    own remaining balance.
    """
    ordered = _ordered_quantities(quotation)
    delivered = await _delivered_by_slug(db, quotation.id)
    invoiced = await _invoiced_by_slug(db, quotation.id)

    if exclude_challan:
        rows = await db.execute(
            select(ChallanLine.slug, func.sum(ChallanLine.quantity))
            .where(ChallanLine.challan_id == exclude_challan)
            .group_by(ChallanLine.slug)
        )
        for slug, total in rows.all():
            delivered[slug] = delivered.get(slug, 0) - int(total or 0)

    out: list[dict] = []
    for entry in sorted(ordered.values(), key=lambda e: e["position"]):
        shipped = max(0, delivered.get(entry["slug"], 0))
        billed = max(0, invoiced.get(entry["slug"], 0))
        out.append(
            {
                **entry,
                "delivered": shipped,
                "invoiced": billed,
                "balance": max(0, entry["ordered"] - shipped),
                "uninvoiced": max(0, entry["ordered"] - billed),
            }
        )
    return out


async def delivery_is_complete(db: AsyncSession, quotation: Quotation) -> bool:
    """True once every ordered line has shipped in full."""
    balances = await order_balances(db, quotation)
    return bool(balances) and all(b["balance"] == 0 for b in balances)


# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------


def compute_totals(
    lines: list[dict],
    *,
    discount: float = 0.0,
    tax_rate: float = 0.0,
    other_charges: float = 0.0,
) -> dict:
    """Subtotal, tax and grand total from the priced lines.

    Tax applies after the discount, which is the normal reading of a discounted
    invoice: the customer is taxed on what they are actually charged.
    """
    subtotal = sum(float(l.get("quantity") or 0) * float(l.get("unitPrice") or 0) for l in lines)
    discount = max(0.0, float(discount or 0))
    taxable = max(0.0, subtotal - discount)
    tax_amount = taxable * (float(tax_rate or 0) / 100.0)
    grand_total = taxable + tax_amount + float(other_charges or 0)
    return {
        "subtotal": _round(subtotal),
        "discount": _round(discount),
        "tax_rate": float(tax_rate or 0),
        "tax_amount": _round(tax_amount),
        "other_charges": _round(float(other_charges or 0)),
        "grand_total": _round(grand_total),
    }


async def get_invoice(db: AsyncSession, invoice_id: str) -> Invoice | None:
    return await db.scalar(
        select(Invoice)
        .where(Invoice.id == invoice_id)
        .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        # The instance is usually already in the identity map from the write
        # that preceded this read, and its collections would still hold the
        # pre-write contents. Without this the caller gets an invoice whose
        # totals are right but whose payment list looks empty.
        .execution_options(populate_existing=True)
    )


async def list_invoices(db: AsyncSession, *, status: str | None = None) -> list[Invoice]:
    stmt = select(Invoice).options(selectinload(Invoice.lines), selectinload(Invoice.payments))
    if status and status != "all":
        stmt = stmt.where(Invoice.status == status)
    stmt = stmt.order_by(Invoice.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


async def create_invoice(
    db: AsyncSession,
    quotation: Quotation,
    *,
    lines: list[dict],
    discount: float = 0.0,
    tax_rate: float = 0.0,
    other_charges: float = 0.0,
    notes: str = "",
) -> Invoice:
    """Saves a draft invoice in the Pending list. No number is assigned yet."""
    totals = compute_totals(
        lines, discount=discount, tax_rate=tax_rate, other_charges=other_charges
    )
    invoice = Invoice(
        quotation_id=quotation.id,
        status="pending",
        notes=notes,
        **totals,
    )
    db.add(invoice)
    await db.flush()

    for position, line in enumerate(lines):
        quantity = int(line.get("quantity") or 0)
        unit_price = float(line.get("unitPrice") or 0)
        db.add(
            InvoiceLine(
                invoice_id=invoice.id,
                slug=line.get("slug") or "",
                name=line.get("name") or "",
                specifications=line.get("specifications") or "",
                unit=line.get("unit") or "Pcs",
                quantity=quantity,
                unit_price=unit_price,
                total=_round(quantity * unit_price),
                position=position,
            )
        )

    await db.commit()
    return await get_invoice(db, invoice.id)


async def update_invoice(
    db: AsyncSession,
    invoice: Invoice,
    *,
    lines: list[dict] | None = None,
    discount: float | None = None,
    tax_rate: float | None = None,
    other_charges: float | None = None,
    notes: str | None = None,
) -> Invoice:
    """Edits a pending invoice. Approved documents are not editable — the
    number is out with the customer by then, so a correction is a new invoice.
    """
    if lines is not None:
        for existing in list(invoice.lines):
            await db.delete(existing)
        await db.flush()
        for position, line in enumerate(lines):
            quantity = int(line.get("quantity") or 0)
            unit_price = float(line.get("unitPrice") or 0)
            db.add(
                InvoiceLine(
                    invoice_id=invoice.id,
                    slug=line.get("slug") or "",
                    name=line.get("name") or "",
                    specifications=line.get("specifications") or "",
                    unit=line.get("unit") or "Pcs",
                    quantity=quantity,
                    unit_price=unit_price,
                    total=_round(quantity * unit_price),
                    position=position,
                )
            )

    if notes is not None:
        invoice.notes = notes

    effective_lines = lines if lines is not None else [
        {"quantity": l.quantity, "unitPrice": l.unit_price} for l in invoice.lines
    ]
    totals = compute_totals(
        effective_lines,
        discount=invoice.discount if discount is None else discount,
        tax_rate=invoice.tax_rate if tax_rate is None else tax_rate,
        other_charges=invoice.other_charges if other_charges is None else other_charges,
    )
    for field, value in totals.items():
        setattr(invoice, field, value)

    await db.commit()
    return await get_invoice(db, invoice.id)


async def approve_invoice(db: AsyncSession, invoice: Invoice, company_name: str) -> Invoice:
    """Assigns the formal number and date. Idempotent: re-approving keeps the
    number already issued, since the customer may be holding it."""
    if invoice.invoice_number is None:
        sequence = await _next_sequence(db, Invoice, Invoice.invoice_number)
        today = business_today()
        invoice.invoice_number = _document_number("I", company_name, sequence, today.year)
        invoice.invoice_date = today.isoformat()
        invoice.approved_at = _now()
    await db.commit()
    return await get_invoice(db, invoice.id)


async def mark_invoice_submitted(db: AsyncSession, invoice: Invoice) -> Invoice:
    invoice.submitted_at = _now()
    if invoice.status == "pending":
        invoice.status = "submitted"
    await db.commit()
    return await get_invoice(db, invoice.id)


async def record_payment(
    db: AsyncSession,
    invoice: Invoice,
    *,
    amount: float,
    method: str = "",
    reference: str = "",
    note: str = "",
    received_at: datetime | None = None,
) -> Invoice:
    """Records one receipt and re-derives the payment status.

    The status follows from the arithmetic rather than being set by hand: an
    invoice is paid when the money adds up, not when someone remembers to
    change a dropdown.
    """
    db.add(
        InvoicePayment(
            invoice_id=invoice.id,
            amount=_round(float(amount)),
            method=method,
            reference=reference,
            note=note,
            received_at=received_at or _now(),
        )
    )
    await db.flush()

    paid = await db.scalar(
        select(func.sum(InvoicePayment.amount)).where(InvoicePayment.invoice_id == invoice.id)
    )
    invoice.amount_paid = _round(float(paid or 0))

    if invoice.status not in VOID_STATUSES:
        # Half a paisa of float error should not leave an invoice one unit
        # short of paid forever.
        if invoice.amount_paid + 0.01 >= invoice.grand_total:
            invoice.status = "paid"
        elif invoice.amount_paid > 0:
            invoice.status = "partially_paid"

    await db.commit()
    return await get_invoice(db, invoice.id)


async def set_invoice_status(db: AsyncSession, invoice: Invoice, status: str) -> Invoice:
    invoice.status = status
    if status == "completed":
        invoice.completed_at = _now()
    await db.commit()
    return await get_invoice(db, invoice.id)


# ---------------------------------------------------------------------------
# Challans
# ---------------------------------------------------------------------------


async def get_challan(db: AsyncSession, challan_id: str) -> Challan | None:
    return await db.scalar(
        select(Challan)
        .where(Challan.id == challan_id)
        .options(selectinload(Challan.lines))
        # Same reason as get_invoice: a cached instance would hand back the
        # line collection as it stood before the write.
        .execution_options(populate_existing=True)
    )


async def list_challans(db: AsyncSession, *, status: str | None = None) -> list[Challan]:
    stmt = select(Challan).options(selectinload(Challan.lines))
    if status and status != "all":
        stmt = stmt.where(Challan.status == status)
    stmt = stmt.order_by(Challan.created_at.desc())
    return list((await db.execute(stmt)).scalars().all())


class OverDelivery(ValueError):
    """Raised when a challan would ship more than the order still owes."""


async def _guard_quantities(
    db: AsyncSession,
    quotation: Quotation,
    lines: list[dict],
    *,
    exclude_challan: str | None = None,
) -> None:
    balances = {b["slug"]: b for b in await order_balances(db, quotation, exclude_challan=exclude_challan)}
    for line in lines:
        slug = line.get("slug") or ""
        quantity = int(line.get("quantity") or 0)
        if quantity <= 0:
            continue
        balance = balances.get(slug)
        if balance is None:
            raise OverDelivery(f"'{slug}' is not on this order.")
        if quantity > balance["balance"]:
            raise OverDelivery(
                f"{balance['name'] or slug}: only {balance['balance']} left to deliver, "
                f"but {quantity} was entered."
            )


async def create_challan(
    db: AsyncSession,
    quotation: Quotation,
    *,
    lines: list[dict],
    delivery_address: str = "",
    remarks: str = "",
) -> Challan:
    await _guard_quantities(db, quotation, lines)

    challan = Challan(
        quotation_id=quotation.id,
        status="pending",
        delivery_address=delivery_address,
        remarks=remarks,
    )
    db.add(challan)
    await db.flush()

    for position, line in enumerate(lines):
        quantity = int(line.get("quantity") or 0)
        if quantity <= 0:
            continue
        db.add(
            ChallanLine(
                challan_id=challan.id,
                slug=line.get("slug") or "",
                name=line.get("name") or "",
                specifications=line.get("specifications") or "",
                unit=line.get("unit") or "Pcs",
                quantity=quantity,
                position=position,
            )
        )

    await db.commit()
    return await get_challan(db, challan.id)


async def update_challan(
    db: AsyncSession,
    challan: Challan,
    quotation: Quotation,
    *,
    lines: list[dict] | None = None,
    delivery_address: str | None = None,
    remarks: str | None = None,
) -> Challan:
    if lines is not None:
        # Its own quantities are excluded from the balance, so an unchanged
        # line does not read as an over-delivery against itself.
        await _guard_quantities(db, quotation, lines, exclude_challan=challan.id)
        for existing in list(challan.lines):
            await db.delete(existing)
        await db.flush()
        for position, line in enumerate(lines):
            quantity = int(line.get("quantity") or 0)
            if quantity <= 0:
                continue
            db.add(
                ChallanLine(
                    challan_id=challan.id,
                    slug=line.get("slug") or "",
                    name=line.get("name") or "",
                    specifications=line.get("specifications") or "",
                    unit=line.get("unit") or "Pcs",
                    quantity=quantity,
                    position=position,
                )
            )

    if delivery_address is not None:
        challan.delivery_address = delivery_address
    if remarks is not None:
        challan.remarks = remarks

    await db.commit()
    return await get_challan(db, challan.id)


async def approve_challan(db: AsyncSession, challan: Challan, company_name: str) -> Challan:
    if challan.challan_number is None:
        sequence = await _next_sequence(db, Challan, Challan.challan_number)
        today = business_today()
        challan.challan_number = _document_number("C", company_name, sequence, today.year)
        challan.challan_date = today.isoformat()
        challan.approved_at = _now()
    await db.commit()
    return await get_challan(db, challan.id)


async def dispatch_challan(
    db: AsyncSession,
    challan: Challan,
    *,
    vehicle_number: str = "",
    driver_info: str = "",
    receiver_name: str = "",
    remarks: str | None = None,
) -> Challan:
    challan.vehicle_number = vehicle_number
    challan.driver_info = driver_info
    challan.receiver_name = receiver_name
    if remarks is not None:
        challan.remarks = remarks
    challan.status = "dispatched"
    challan.dispatched_at = _now()
    await db.commit()
    return await get_challan(db, challan.id)


async def deliver_challan(
    db: AsyncSession, challan: Challan, *, signed_document_url: str | None = None
) -> Challan:
    challan.status = "delivered"
    challan.delivered_at = _now()
    if signed_document_url is not None:
        challan.signed_document_url = signed_document_url
    await db.commit()
    return await get_challan(db, challan.id)


async def set_challan_status(db: AsyncSession, challan: Challan, status: str) -> Challan:
    challan.status = status
    await db.commit()
    return await get_challan(db, challan.id)
