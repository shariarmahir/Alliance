import secrets
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Challan,
    ChallanLine,
    ContactRequest,
    Invoice,
    InvoiceLine,
    Order,
    OrderConfirmation,
    Product,
    Quotation,
)
from app.models.base import business_today

# Delivery stages shared with the customer tracking page.
# Two states, not a delivery pipeline: the business arranges freight directly
# with the customer, so the middle stages were never tracked against reality.
# "Confirmed" is the terminal state and is what triggers the customer email.
DELIVERY_STAGES = [
    {"label": "Pending", "hint": "Your order is being prepared."},
    {"label": "Confirmed", "hint": "Your order is confirmed. Our team will arrange delivery with you."},
]
MAX_STAGE = len(DELIVERY_STAGES) - 1

DEFAULT_TERMS = {
    "payment": "100% Cash/Pay order.",
    "delivery": "From Ready Stock",
    "offerValidity": "07 days, From the Offer Date.",
    "vatAit": "Excluded.",
    "stock": "Available.",
    "installationCharge": "Free.",
    "warranty": "12 Months Warranty (From the date of delivery)",
}


def clamp_stage(stage: int | None) -> int:
    if stage is None:
        return 0
    return max(0, min(MAX_STAGE, int(stage)))


def stage_label(stage: int) -> str:
    return DELIVERY_STAGES[clamp_stage(stage)]["label"]


# ---------------------------------------------------------------------------
# ID generation — server-side only, so a client cannot choose its own IDs
# ---------------------------------------------------------------------------


def _random_code(length: int) -> str:
    """Base-36 over a CSPRNG. Short enough to read off a printed PDF, wide
    enough that collisions within one order are not a practical concern."""
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_product_id() -> str:
    return f"AIT-PRD-{_random_code(6)}"


def generate_tracking_id() -> str:
    return f"AIT-TRK-{_random_code(8)}"


def generate_order_number() -> str:
    return f"AIT-ORD-{_random_code(8)}"


def generate_ref_number(company_name: str, sequence: int, when: date) -> str:
    """Company initials, a global sequence number, and the issue year."""
    initials = "".join(word[0] for word in (company_name or "").split() if word)[:4].upper()
    return f"AIT/{initials or 'GEN'}/Q-{sequence:04d}/{when.year}"


def default_subject(items: list[dict]) -> str:
    lead = (items[0].get("name") if items else None) or "industrial automation parts"
    if len(items) > 1:
        others = len(items) - 1
        plural = "s" if len(items) > 2 else ""
        return f"Financial Offer for supply of {lead} and {others} other item{plural}."
    return f"Financial Offer for supply of {lead}."


_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen",
]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _under_thousand(n: int) -> str:
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + (f" {_ONES[n % 10]}" if n % 10 else "")
    return f"{_ONES[n // 100]} Hundred" + (f" {_under_thousand(n % 100)}" if n % 100 else "")


def amount_in_words(amount: float) -> str:
    """South Asian numbering (lakh/crore), matching how a BDT invoice reads."""
    n = int(abs(amount))
    if n == 0:
        return "Zero Taka only."

    parts: list[str] = []
    crore, n_rest = divmod(n, 10_000_000)
    lakh, n_rest = divmod(n_rest, 100_000)
    thousand, rest = divmod(n_rest, 1000)

    if crore:
        parts.append(f"{_under_thousand(crore)} Crore")
    if lakh:
        parts.append(f"{_under_thousand(lakh)} Lakh")
    if thousand:
        parts.append(f"{_under_thousand(thousand)} Thousand")
    if rest:
        parts.append(_under_thousand(rest))

    return f"{' '.join(parts)} Taka only."


# ---------------------------------------------------------------------------
# Quotations
# ---------------------------------------------------------------------------


async def add_quotation(db: AsyncSession, items: list[dict], details: dict) -> Quotation:
    """Totals are computed here, never taken from the client — a submitted
    total is a customer-supplied number and must not be trusted.

    Unit prices are re-read from the catalogue for the same reason: the browser
    sends them, so a crafted request could otherwise post a $2,000 part at
    $0.01 and have that figure sit in the admin's queue looking like the
    customer's own request. A slug that no longer exists prices at 0 rather
    than rejecting the enquiry — the admin prices every line by hand when
    issuing anyway, and losing a genuine customer's request is the worse
    failure.
    """
    slugs = {str(i.get("slug", "")) for i in items if i.get("slug")}
    catalogue: dict[str, float] = {}
    if slugs:
        rows = await db.execute(
            select(Product.slug, Product.price).where(Product.slug.in_(slugs))
        )
        catalogue = {slug: float(price) for slug, price in rows.all()}

    items = [
        {**item, "price": catalogue.get(str(item.get("slug", "")), 0.0)}
        for item in items
    ]
    total = sum(float(i["price"]) * int(i.get("quantity", 0)) for i in items)
    submitted_at = datetime.now(timezone.utc)
    details = {**details, "submittedAt": submitted_at.isoformat()}

    quotation = Quotation(
        items=items,
        total=round(total, 2),
        details=details,
        # A brand-new customer request is untouched work: it belongs in the
        # inbox, not in "pending", which now means a quotation was prepared.
        status="inbox",
        customer_email=(details.get("email") or "").strip().lower(),
        submitted_at=submitted_at,
    )
    db.add(quotation)
    await db.commit()
    await db.refresh(quotation)
    return quotation


async def get_quotation(db: AsyncSession, quotation_id: str) -> Quotation | None:
    return (
        await db.execute(select(Quotation).where(Quotation.id == quotation_id))
    ).scalar_one_or_none()


async def list_quotations(db: AsyncSession, status: str | None = None) -> list[Quotation]:
    stmt = select(Quotation).order_by(Quotation.submitted_at.desc())
    if status:
        stmt = stmt.where(Quotation.status == status)
    return list((await db.execute(stmt)).scalars().all())


async def delete_cancelled_quotations(db: AsyncSession) -> int:
    """Permanently removes every cancelled quotation. Returns how many went.

    Scoped to "cancelled" in the query itself rather than taking a list of ids
    from the caller: a bulk delete driven by client-supplied ids would remove
    whatever it was handed, so a stale page or a crafted request could destroy
    live requests. Here the database decides what qualifies.

    Their order confirmations cascade, but a cancelled quotation has already
    had its confirmation retracted by update_quotation_status, so in practice
    there is nothing left to cascade to.
    """
    rows = (
        await db.execute(select(Quotation).where(Quotation.status == "cancelled"))
    ).scalars().all()
    for quotation in rows:
        await db.delete(quotation)
    await db.commit()
    return len(rows)


class WorkflowRefused(Exception):
    """Raised when a move would skip or reverse the client's workflow chain.

    Inbox -> Prepare -> Save -> Pending -> Send E-mail -> Submitted ->
    Customer Confirmation -> Verify/Revise -> Work Order/PO -> Confirmed.
    The stages all existed; nothing enforced the arrows between them.
    """


class ConfirmationInUse(Exception):
    """Raised when retracting a confirmation would orphan real paperwork.

    Item 14 requires the confirmed record to remain available "for future
    documentation, reference, tracking, and audit purposes". Invoices and
    challans are built from the confirmation's lines, prices and reference,
    so deleting it leaves an approved invoice pointing at nothing.
    """


async def _documents_against(db: AsyncSession, quotation_id: str) -> tuple[int, int]:
    """Live invoices and challans on an order. Cancelled ones do not count:
    a document that was itself withdrawn is not paperwork to protect."""
    invoices = await db.scalar(
        select(func.count())
        .select_from(Invoice)
        .where(Invoice.quotation_id == quotation_id, Invoice.status != "cancelled")
    )
    challans = await db.scalar(
        select(func.count())
        .select_from(Challan)
        .where(Challan.quotation_id == quotation_id, Challan.status != "cancelled")
    )
    return int(invoices or 0), int(challans or 0)


# Documents an admin can still withdraw themselves. Past these states the
# document carries receipts or delivered goods and is refused by
# billing._guard_transition, which means the order behind it can never be
# withdrawn either -- so the refusal must say which of the two situations
# the admin is in rather than sending them to retry something impossible.
_WITHDRAWABLE_INVOICE = ("pending", "submitted")
_WITHDRAWABLE_CHALLAN = ("pending",)


async def _settled_documents(db: AsyncSession, quotation_id: str) -> tuple[int, int]:
    """Live documents that are past the point of being cancelled."""
    invoices = await db.scalar(
        select(func.count())
        .select_from(Invoice)
        .where(
            Invoice.quotation_id == quotation_id,
            Invoice.status.notin_(("cancelled", *_WITHDRAWABLE_INVOICE)),
        )
    )
    challans = await db.scalar(
        select(func.count())
        .select_from(Challan)
        .where(
            Challan.quotation_id == quotation_id,
            Challan.status.notin_(("cancelled", *_WITHDRAWABLE_CHALLAN)),
        )
    )
    return int(invoices or 0), int(challans or 0)


async def payment_position(db: AsyncSession, quotation: Quotation) -> dict:
    """What an order has been invoiced for and what has been received.

    Derived from the invoices on every read rather than stored on the order.
    The Orders screen used to carry its own payment_status, set by hand, which
    knew nothing about the receipts recorded against the invoices -- so an
    order paid in full through its invoices still read PENDING, and one marked
    RECEIVED could have unpaid invoices behind it. Two numbers for one debt is
    one number too many.

    A cancelled invoice is excluded: it is not owed, and its receipts (if any)
    belong to the document that replaced it.
    """
    invoiced = await db.scalar(
        select(func.sum(Invoice.grand_total)).where(
            Invoice.quotation_id == quotation.id, Invoice.status != "cancelled"
        )
    )
    paid = await db.scalar(
        select(func.sum(Invoice.amount_paid)).where(
            Invoice.quotation_id == quotation.id, Invoice.status != "cancelled"
        )
    )
    invoiced = round(float(invoiced or 0), 2)
    paid = round(float(paid or 0), 2)

    # Nothing billed means nothing can have been received, so an order with no
    # invoice reads pending rather than settled by vacuous truth.
    settled = invoiced > 0 and paid + 0.01 >= invoiced
    return {
        "amount_invoiced": invoiced,
        "amount_paid": paid,
        "amount_outstanding": round(max(0.0, invoiced - paid), 2),
        "payment_status": "received" if settled else "pending",
    }


async def delivered_in_full(db: AsyncSession, quotation: Quotation) -> bool:
    """Section B's Completed: every confirmed line delivered in full.

    Derived from the challans on each call rather than stored on the order,
    so cancelling a challan reopens it automatically -- a stored flag would
    keep saying Completed for goods that came back.
    """
    if quotation.confirmation is None:
        return False
    ordered: dict[str, int] = {}
    for line in quotation.confirmation.lines or []:
        slug = line.get("slug") or ""
        if slug:
            ordered[slug] = ordered.get(slug, 0) + int(line.get("quantity") or 0)
    if not ordered:
        return False

    rows = await db.execute(
        select(ChallanLine.slug, func.sum(ChallanLine.quantity))
        .join(Challan, Challan.id == ChallanLine.challan_id)
        .where(Challan.quotation_id == quotation.id, Challan.status != "cancelled")
        .group_by(ChallanLine.slug)
    )
    delivered = {slug: int(total or 0) for slug, total in rows.all()}
    return all(delivered.get(slug, 0) >= qty for slug, qty in ordered.items())


async def _committed_quantities(db: AsyncSession, quotation_id: str) -> dict[str, int]:
    """The most any line has already been invoiced or delivered.

    Item 12 lets a confirmed order be corrected to the customer's PO, and
    correcting downwards is normal -- the PO often comes back for less than
    was quoted. What it cannot do is fall below what has already been billed
    or shipped: the documents are facts that have left the building, and an
    order smaller than its own paperwork makes every balance nonsense.
    """
    committed: dict[str, int] = {}

    invoiced = await db.execute(
        select(InvoiceLine.slug, func.sum(InvoiceLine.quantity))
        .join(Invoice, Invoice.id == InvoiceLine.invoice_id)
        .where(Invoice.quotation_id == quotation_id, Invoice.status != "cancelled")
        .group_by(InvoiceLine.slug)
    )
    for slug, total in invoiced.all():
        committed[slug] = max(committed.get(slug, 0), int(total or 0))

    delivered = await db.execute(
        select(ChallanLine.slug, func.sum(ChallanLine.quantity))
        .join(Challan, Challan.id == ChallanLine.challan_id)
        .where(Challan.quotation_id == quotation_id, Challan.status != "cancelled")
        .group_by(ChallanLine.slug)
    )
    for slug, total in delivered.all():
        committed[slug] = max(committed.get(slug, 0), int(total or 0))

    return committed


async def update_quotation_status(
    db: AsyncSession, quotation_id: str, status: str
) -> Quotation | None:
    quotation = await get_quotation(db, quotation_id)
    if quotation is None:
        return None

    # Moving off "confirmed" retracts the issued document: leaving it behind
    # would let a cancelled quotation still serve a downloadable confirmation.
    # But it can only be retracted while nothing has been built on top of it.
    if status != "confirmed" and quotation.confirmation is not None:
        invoices, challans = await _documents_against(db, quotation_id)
        if invoices or challans:
            settled_inv, settled_chl = await _settled_documents(db, quotation_id)
            if settled_inv or settled_chl:
                # These cannot be withdrawn at all, so telling the admin to
                # "cancel those documents first" would send them in a circle.
                raise ConfirmationInUse(
                    f"This order has {settled_inv} paid/completed invoice(s) and "
                    f"{settled_chl} dispatched/delivered challan(s) against it. "
                    "Those are a permanent record and cannot be withdrawn, so "
                    "this order cannot be cancelled. Raise a credit note or "
                    "record a return instead."
                )
            raise ConfirmationInUse(
                f"This order has {invoices} invoice(s) and {challans} challan(s) "
                "raised against it. Cancel those documents first, then cancel "
                "the order."
            )
        await db.delete(quotation.confirmation)
        quotation.confirmation = None

    quotation.status = status
    await db.commit()
    await db.refresh(quotation)
    return quotation


async def next_confirmation_sequence(db: AsyncSession) -> int:
    """Global count of issued confirmations + 1, so refs increment across the
    business rather than per customer."""
    count = (await db.execute(select(func.count()).select_from(OrderConfirmation))).scalar_one()
    return int(count) + 1


async def confirm_quotation(
    db: AsyncSession,
    quotation_id: str,
    lines: list[dict],
    terms: dict | None = None,
    ref_number: str | None = None,
    subject: str = "",
    issued_date: str | None = None,
    confirm: bool = True,
) -> Quotation | None:
    """Saves the priced offer, and by default flips the quotation to confirmed
    in the same commit so the two can never disagree.

    With confirm=False the offer is written and an inbox request moves to
    "pending" — prepared but not yet sent. That is what lets an admin price a
    request, download or email the PDF, and still decide separately whether to
    accept it. A request already submitted, confirmed or cancelled is never
    walked backwards."""
    quotation = await get_quotation(db, quotation_id)
    if quotation is None:
        return None

    # The Recommended Workflow is a chain, and these are the arrows into it.
    #
    # A cancelled request is out of the workflow entirely: re-pricing or
    # confirming one revives a dead record mid-chain.
    if quotation.status == "cancelled":
        raise WorkflowRefused(
            "This request was cancelled. Reopen it before preparing a quotation."
        )

    # Item 12: revising a confirmed order to match the PO is expected, and
    # revising downwards is normal. It just cannot go below what invoices and
    # challans have already committed -- those documents are with the customer.
    if quotation.confirmation is not None:
        committed = await _committed_quantities(db, quotation.id)
        if committed:
            revised = {
                (line.get("slug") or ""): int(line.get("quantity", 0)) for line in lines
            }
            for slug, already in committed.items():
                if revised.get(slug, 0) < already:
                    raise WorkflowRefused(
                        f"'{slug}' has already been invoiced or delivered in a "
                        f"quantity of {already}. Cancel those documents before "
                        "reducing this line."
                    )
    priced: list[dict] = []
    grand_total = 0.0
    for line in lines:
        quantity = int(line.get("quantity", 0))
        unit_price = float(line.get("unitPrice", line.get("unit_price", 0)))
        total = round(quantity * unit_price, 2)
        grand_total += total
        priced.append(
            {
                **line,
                "productId": line.get("productId") or generate_product_id(),
                "quantity": quantity,
                "unitPrice": unit_price,
                "total": total,
            }
        )

    company = (quotation.details or {}).get("companyName") or ""
    # Dhaka, not UTC: an offer issued after 18:00 UTC would otherwise carry
    # yesterday's date on the PDF the customer receives.
    today = business_today()

    if quotation.confirmation is not None:
        # Re-issuing keeps the original ref and tracking ID: the customer may
        # already be holding both on a printed document.
        confirmation = quotation.confirmation
        confirmation.lines = priced
        confirmation.grand_total = round(grand_total, 2)
        confirmation.terms = terms or confirmation.terms or DEFAULT_TERMS
        confirmation.subject = subject or confirmation.subject
        if issued_date:
            confirmation.issued_date = issued_date
    else:
        sequence = await next_confirmation_sequence(db)
        confirmation = OrderConfirmation(
            quotation_id=quotation.id,
            ref_number=ref_number or generate_ref_number(company, sequence, today),
            subject=subject or default_subject(quotation.items or []),
            issued_date=issued_date or today.isoformat(),
            tracking_id=generate_tracking_id(),
            lines=priced,
            grand_total=round(grand_total, 2),
            terms=terms or DEFAULT_TERMS,
            delivery_stage=0,
        )
        db.add(confirmation)

    if confirm:
        quotation.status = "confirmed"
    elif quotation.status == "inbox":
        # Preparing a quotation moves an untouched request out of the inbox.
        # Only from inbox: re-pricing a submitted, confirmed or cancelled
        # request must not drag it backwards through the workflow.
        quotation.status = "pending"
    await db.commit()
    await db.refresh(quotation)
    return quotation


async def mark_quotation_submitted(db: AsyncSession, quotation_id: str) -> Quotation | None:
    """Records that the quotation reached the customer.

    Called only after the send actually succeeded, so "submitted" always means
    a real email went out. Advances from pending; a quotation already confirmed
    or cancelled keeps its status, since re-sending a copy of the document does
    not undo the customer's decision.
    """
    quotation = await get_quotation(db, quotation_id)
    if quotation is None:
        return None

    quotation.quoted_sent_at = datetime.now(timezone.utc)
    if quotation.status in ("inbox", "pending"):
        quotation.status = "submitted"
    await db.commit()
    await db.refresh(quotation)
    return quotation


async def record_work_order(
    db: AsyncSession,
    quotation_id: str,
    *,
    po_number: str | None = None,
    document_url: str | None = None,
) -> Quotation | None:
    """Attaches the customer's Work Order / PO to the quotation.

    Number and document arrive separately — the number is often known from an
    email before the signed PDF follows — so each is written only when given
    rather than blanking the other.
    """
    quotation = await get_quotation(db, quotation_id)
    if quotation is None:
        return None

    if po_number is not None:
        quotation.po_number = po_number.strip()
    if document_url is not None:
        quotation.po_document_url = document_url
        quotation.po_uploaded_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(quotation)
    return quotation


async def update_payment_status(
    db: AsyncSession, quotation_id: str, status: str
) -> Quotation | None:
    """Records whether payment has been received against a confirmed order.

    Stamps the time on the transition into "received" and clears it when
    reversed, so the money receipt prints the date payment was actually
    recorded rather than the day the PDF happened to be produced.
    """
    quotation = await get_quotation(db, quotation_id)
    if quotation is None or quotation.confirmation is None:
        return None

    confirmation = quotation.confirmation
    if status == "received" and confirmation.payment_status != "received":
        confirmation.payment_received_at = datetime.now(timezone.utc)
    elif status != "received":
        confirmation.payment_received_at = None
    confirmation.payment_status = status

    await db.commit()
    await db.refresh(quotation)
    return quotation


async def find_by_tracking_id(db: AsyncSession, tracking_id: str) -> Quotation | None:
    """Only confirmed quotations are reachable — tracking IDs are minted at
    confirmation time, so an unknown ID is a miss rather than an invented status."""
    wanted = (tracking_id or "").strip().upper()
    if not wanted:
        return None
    confirmation = (
        await db.execute(
            select(OrderConfirmation).where(func.upper(OrderConfirmation.tracking_id) == wanted)
        )
    ).scalar_one_or_none()
    if confirmation is None:
        return None
    return await get_quotation(db, confirmation.quotation_id)


async def update_delivery_stage(
    db: AsyncSession, tracking_id: str, stage: int
) -> Quotation | None:
    quotation = await find_by_tracking_id(db, tracking_id)
    if quotation is None or quotation.confirmation is None:
        return None
    quotation.confirmation.delivery_stage = clamp_stage(stage)
    quotation.confirmation.delivery_updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(quotation)
    return quotation


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------


async def add_order(db: AsyncSession, data: dict) -> Order:
    address = data.get("address") or {}
    order = Order(
        order_number=generate_order_number(),
        tracking_id=generate_tracking_id(),
        items=data.get("items", []),
        subtotal=float(data.get("subtotal", 0)),
        shipping_cost=float(data.get("shipping_cost", 0)),
        grand_total=float(data.get("grand_total", 0)),
        delivery_option=data.get("delivery_option", "standard"),
        delivery_option_name=data.get("delivery_option_name", ""),
        delivery_eta=data.get("delivery_eta", ""),
        preferred_date=data.get("preferred_date", ""),
        address=address,
        customer_name=(address.get("name") or "").strip(),
        status="pending",
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def get_order(db: AsyncSession, order_number: str) -> Order | None:
    return await db.get(Order, order_number)


async def list_orders(db: AsyncSession, status: str | None = None) -> list[Order]:
    stmt = select(Order).order_by(Order.placed_at.desc())
    if status:
        stmt = stmt.where(Order.status == status)
    return list((await db.execute(stmt)).scalars().all())


async def update_order_status(db: AsyncSession, order_number: str, status: str) -> Order | None:
    order = await get_order(db, order_number)
    if order is None:
        return None
    order.status = status
    await db.commit()
    await db.refresh(order)
    return order


# ---------------------------------------------------------------------------
# Contact requests
# ---------------------------------------------------------------------------


async def add_contact_request(db: AsyncSession, data: dict) -> ContactRequest:
    request = ContactRequest(
        name=data["name"],
        email=data["email"],
        subject=data.get("subject", ""),
        message=data["message"],
        handled=False,
    )
    db.add(request)
    await db.commit()
    await db.refresh(request)
    return request


async def list_contact_requests(db: AsyncSession) -> list[ContactRequest]:
    return list(
        (await db.execute(select(ContactRequest).order_by(ContactRequest.submitted_at.desc())))
        .scalars()
        .all()
    )


async def mark_contact_request_handled(
    db: AsyncSession, request_id: str, handled: bool
) -> ContactRequest | None:
    request = await db.get(ContactRequest, request_id)
    if request is None:
        return None
    request.handled = handled
    await db.commit()
    await db.refresh(request)
    return request
