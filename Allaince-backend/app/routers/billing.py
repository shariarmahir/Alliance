import logging
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status

from app.core.deps import DbSession, require_any_area, require_area
from app.integrations import pdf as pdf_integration
from app.integrations.object_storage import (
    ImageRejected,
    safe_filename,
    save_image,
    validate_document,
)
from app.schemas.billing import (
    ChallanCreate,
    ChallanDispatch,
    ChallanOut,
    ChallanStatusUpdate,
    ChallanUpdate,
    HistoryEvent,
    InvoiceCreate,
    InvoiceOut,
    InvoicePaymentIn,
    InvoiceStatusUpdate,
    InvoiceUpdate,
    OrderBalanceLine,
    OrderHistory,
)
from app.schemas.session import AdminSession
from app.services import billing as svc
from app.services import operations as ops

logger = logging.getLogger("app.billing")

router = APIRouter(prefix="/api/admin", tags=["billing"])

# Billing and dispatch are separate jobs: someone who updates delivery status
# has no business approving an invoice. The "orders" grant still implies both
# (see IMPLIED_AREAS), so accounts that predate the split keep their access.
OrdersArea = Depends(require_area("orders"))
InvoicesArea = Depends(require_area("invoices"))
ChallansArea = Depends(require_area("challans"))
# Reads that any of the three jobs legitimately needs.
AnyBillingArea = Depends(require_any_area("orders", "invoices", "challans"))
# The History button lives on the Quotations screen, so that grant reads it too.
AnyOrderArea = Depends(require_any_area("quotations", "orders", "invoices", "challans"))


def _customer(quotation) -> dict:
    details = quotation.details or {}
    return {
        "customer_name": details.get("companyName") or details.get("fullName") or "",
        "ref_number": (quotation.confirmation.ref_number if quotation.confirmation else ""),
        "po_number": quotation.po_number or "",
    }


def _invoice_out(invoice, quotation) -> InvoiceOut:
    return InvoiceOut.model_validate({**invoice.__dict__, **_customer(quotation),
                                      "lines": invoice.lines, "payments": invoice.payments})


def _challan_out(challan, quotation) -> ChallanOut:
    return ChallanOut.model_validate({**challan.__dict__, **_customer(quotation),
                                      "lines": challan.lines})


async def _confirmed_order(db, quotation_id: str):
    """Both documents start from a confirmed order — that is the rule the
    client's workflow is built on, so it is enforced in one place."""
    quotation = await ops.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    if quotation.confirmation is None or quotation.status != "confirmed":
        raise HTTPException(
            status_code=400,
            detail="Confirm the order before preparing invoices or challans.",
        )
    return quotation


# --- Order balances ---------------------------------------------------------


@router.get(
    "/quotations/{quotation_id}/balances", response_model=list[OrderBalanceLine]
)
async def order_balances(
    quotation_id: str,
    db: DbSession,
    exclude_challan: str | None = None,
    session: AdminSession = AnyBillingArea,
):
    """What is ordered, delivered, invoiced and still outstanding per line.

    This is what the prepare screens read to stop an admin over-shipping or
    double-billing, so it is derived on every call rather than cached.

    Readable with any of the three grants: an admin who can prepare an
    invoice needs these figures to prepare it safely, and gating them behind
    "orders" alone would leave the guard rails invisible to exactly the
    person about to bill.
    """
    quotation = await _confirmed_order(db, quotation_id)
    rows = await svc.order_balances(db, quotation, exclude_challan=exclude_challan)
    return [OrderBalanceLine.model_validate(r) for r in rows]


@router.get("/quotations/{quotation_id}/history", response_model=OrderHistory)
async def order_history(
    quotation_id: str, db: DbSession, session: AdminSession = AnyOrderArea
):
    """The whole paper trail for one order, oldest first.

    Opened to the quotations grant as well, because the History button that
    reads this lives on the Quotations screen -- gating it behind "orders"
    put a 403 behind a button the same grant had already rendered.

    Assembled from timestamps that already exist rather than an events table:
    a log written alongside the records could disagree with them, and the
    records are the thing an auditor actually checks.
    """
    quotation = await ops.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")

    details = quotation.details or {}
    confirmation = quotation.confirmation
    events: list[HistoryEvent] = []

    events.append(
        HistoryEvent(
            kind="request",
            label="Price request received",
            detail=f"{len(details.get('items') or [])} item(s) requested",
            at=quotation.submitted_at,
        )
    )

    if confirmation is not None:
        events.append(
            HistoryEvent(
                kind="quotation",
                label="Quotation prepared",
                reference=confirmation.ref_number or "",
                amount=confirmation.grand_total,
                at=confirmation.issued_at,
            )
        )

    if quotation.quoted_sent_at is not None:
        events.append(
            HistoryEvent(
                kind="email",
                label="Quotation e-mailed to customer",
                detail=details.get("email") or "",
                at=quotation.quoted_sent_at,
            )
        )

    if quotation.status == "confirmed":
        events.append(
            HistoryEvent(
                kind="confirmed",
                label="Order confirmed by customer",
                reference=confirmation.ref_number if confirmation else "",
                at=confirmation.issued_at if confirmation else None,
            )
        )

    if quotation.po_uploaded_at is not None or quotation.po_number:
        events.append(
            HistoryEvent(
                kind="po",
                label="Work Order / PO received",
                reference=quotation.po_number or "",
                detail="Document attached" if quotation.po_document_url else "",
                at=quotation.po_uploaded_at,
            )
        )

    for invoice in await svc.list_invoices(db, quotation_id=quotation_id):
        events.append(
            HistoryEvent(
                kind="invoice",
                label="Invoice raised",
                reference=invoice.invoice_number or "Draft",
                status=invoice.status,
                amount=invoice.grand_total,
                at=invoice.created_at,
            )
        )

    for challan in await svc.list_challans(db, quotation_id=quotation_id):
        shipped = sum(line.quantity for line in challan.lines or [])
        events.append(
            HistoryEvent(
                kind="challan",
                label="Challan raised",
                reference=challan.challan_number or "Draft",
                detail=f"{shipped} unit(s)",
                status=challan.status,
                at=challan.created_at,
            )
        )

    # Undated events (a PO number typed without a file, say) sort last rather
    # than crashing the comparison or jumping to the top of the timeline.
    events.sort(key=lambda e: (e.at is None, e.at or datetime.min))

    return OrderHistory(
        quotation_id=quotation.id,
        customer_name=details.get("companyName") or details.get("fullName") or "",
        ref_number=confirmation.ref_number if confirmation else "",
        po_number=quotation.po_number or "",
        po_document_url=quotation.po_document_url,
        events=events,
    )


# --- Invoices ---------------------------------------------------------------


@router.get("/invoices", response_model=list[InvoiceOut])
async def list_invoices(
    db: DbSession, status_filter: str | None = None, session: AdminSession = InvoicesArea
):
    invoices = await svc.list_invoices(db, status=status_filter)
    out: list[InvoiceOut] = []
    for invoice in invoices:
        quotation = await ops.get_quotation(db, invoice.quotation_id)
        if quotation is not None:
            out.append(_invoice_out(invoice, quotation))
    return out


@router.post("/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_invoice(payload: InvoiceCreate, db: DbSession, session: AdminSession = InvoicesArea):
    quotation = await _confirmed_order(db, payload.quotation_id)
    try:
        invoice = await svc.create_invoice(
            db,
            quotation,
            lines=[l.model_dump(by_alias=True) for l in payload.lines],
            discount=payload.discount,
            tax_rate=payload.tax_rate,
            other_charges=payload.other_charges,
            notes=payload.notes,
        )
    except svc.OverBilling as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.info("%s prepared an invoice for %s", session.email, quotation.id)
    return _invoice_out(invoice, quotation)


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(invoice_id: str, db: DbSession, session: AdminSession = InvoicesArea):
    invoice = await svc.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    quotation = await ops.get_quotation(db, invoice.quotation_id)
    return _invoice_out(invoice, quotation)


@router.get("/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: str, db: DbSession, session: AdminSession = InvoicesArea):
    """The formal Invoice document — printed, saved as PDF, or e-mailed."""
    invoice = await svc.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    quotation = await ops.get_quotation(db, invoice.quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Linked order not found.")

    try:
        pdf_bytes = pdf_integration.render_invoice_document_pdf(invoice, quotation)
    except pdf_integration.PdfUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    name = (invoice.invoice_number or f"invoice-draft-{invoice.id[:8]}").replace("/", "-")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'},
    )


@router.patch("/invoices/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: str, payload: InvoiceUpdate, db: DbSession, session: AdminSession = InvoicesArea
):
    invoice = await svc.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if invoice.invoice_number is not None:
        # The number is already with the customer; a correction after that is
        # a credit note or a fresh invoice, not a silent edit.
        raise HTTPException(
            status_code=409, detail="An approved invoice cannot be edited."
        )

    quotation = await ops.get_quotation(db, invoice.quotation_id)
    try:
        updated = await svc.update_invoice(
            db,
            invoice,
            quotation,
            lines=(
                [l.model_dump(by_alias=True) for l in payload.lines]
                if payload.lines is not None
                else None
            ),
            discount=payload.discount,
            tax_rate=payload.tax_rate,
            other_charges=payload.other_charges,
            notes=payload.notes,
        )
    except svc.OverBilling as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _invoice_out(updated, quotation)


@router.post("/invoices/{invoice_id}/approve", response_model=InvoiceOut)
async def approve_invoice(invoice_id: str, db: DbSession, session: AdminSession = InvoicesArea):
    invoice = await svc.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    quotation = await ops.get_quotation(db, invoice.quotation_id)
    details = (quotation.details or {}) if quotation else {}
    updated = await svc.approve_invoice(db, invoice, details.get("companyName") or "")
    logger.info("%s approved invoice %s", session.email, updated.invoice_number)
    return _invoice_out(updated, quotation)


@router.post("/invoices/{invoice_id}/submit", response_model=InvoiceOut)
async def submit_invoice(
    invoice_id: str, db: DbSession, session: AdminSession = InvoicesArea
):
    """Marks an approved invoice Submitted.

    Invoices are delivered to the customer outside this system, so this
    records that it has gone out rather than sending anything itself. It
    replaces the earlier e-mail action, which coupled the status change to a
    successful send.

    Approval is still required first: the number is what identifies the
    document to the customer, and submitting one that has none would put a
    nameless invoice into their hands.
    """
    invoice = await svc.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if invoice.invoice_number is None:
        raise HTTPException(
            status_code=409, detail="Approve the invoice before submitting it."
        )
    quotation = await ops.get_quotation(db, invoice.quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Linked order not found.")

    updated = await svc.mark_invoice_submitted(db, invoice)
    logger.info("%s submitted invoice %s", session.email, updated.invoice_number)
    return _invoice_out(updated, quotation)


@router.post("/invoices/{invoice_id}/payments", response_model=InvoiceOut)
async def add_payment(
    invoice_id: str, payload: InvoicePaymentIn, db: DbSession, session: AdminSession = InvoicesArea
):
    invoice = await svc.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    if invoice.invoice_number is None:
        raise HTTPException(
            status_code=400, detail="Approve the invoice before recording payment against it."
        )

    updated = await svc.record_payment(
        db,
        invoice,
        amount=payload.amount,
        method=payload.method,
        reference=payload.reference,
        note=payload.note,
        received_at=payload.received_at,
    )
    quotation = await ops.get_quotation(db, updated.quotation_id)
    if quotation is not None:
        await ops.advance_stage_if_fulfilled(db, quotation)
        quotation = await ops.get_quotation(db, updated.quotation_id)
    return _invoice_out(updated, quotation)


@router.patch("/invoices/{invoice_id}/status", response_model=InvoiceOut)
async def set_invoice_status(
    invoice_id: str, payload: InvoiceStatusUpdate, db: DbSession, session: AdminSession = InvoicesArea
):
    invoice = await svc.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    try:
        updated = await svc.set_invoice_status(db, invoice, payload.status)
    except svc.TransitionRefused as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    quotation = await ops.get_quotation(db, updated.quotation_id)
    if quotation is not None:
        await ops.advance_stage_if_fulfilled(db, quotation)
        quotation = await ops.get_quotation(db, updated.quotation_id)
    return _invoice_out(updated, quotation)


# --- Challans ---------------------------------------------------------------


@router.get("/challans", response_model=list[ChallanOut])
async def list_challans(
    db: DbSession, status_filter: str | None = None, session: AdminSession = ChallansArea
):
    challans = await svc.list_challans(db, status=status_filter)
    out: list[ChallanOut] = []
    for challan in challans:
        quotation = await ops.get_quotation(db, challan.quotation_id)
        if quotation is not None:
            out.append(_challan_out(challan, quotation))
    return out


@router.post("/challans", response_model=ChallanOut, status_code=status.HTTP_201_CREATED)
async def create_challan(payload: ChallanCreate, db: DbSession, session: AdminSession = ChallansArea):
    quotation = await _confirmed_order(db, payload.quotation_id)
    try:
        challan = await svc.create_challan(
            db,
            quotation,
            lines=[l.model_dump(by_alias=True) for l in payload.lines],
            delivery_address=payload.delivery_address,
            remarks=payload.remarks,
        )
    except svc.OverDelivery as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.info("%s prepared a challan for %s", session.email, quotation.id)
    return _challan_out(challan, quotation)


@router.get("/challans/{challan_id}", response_model=ChallanOut)
async def get_challan(challan_id: str, db: DbSession, session: AdminSession = ChallansArea):
    challan = await svc.get_challan(db, challan_id)
    if challan is None:
        raise HTTPException(status_code=404, detail="Challan not found.")
    quotation = await ops.get_quotation(db, challan.quotation_id)
    return _challan_out(challan, quotation)


@router.get("/challans/{challan_id}/pdf")
async def challan_pdf(challan_id: str, db: DbSession, session: AdminSession = ChallansArea):
    """The Delivery Challan document, carrying the quantity-control table."""
    challan = await svc.get_challan(db, challan_id)
    if challan is None:
        raise HTTPException(status_code=404, detail="Challan not found.")
    quotation = await ops.get_quotation(db, challan.quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Linked order not found.")

    # Excluding this challan is what makes "Previously Delivered" mean prior
    # challans. Include it and every line counts itself, so the printed
    # balance is short by exactly the quantity on the page.
    rows = await svc.order_balances(db, quotation, exclude_challan=challan.id)
    balances = {row["slug"]: row for row in rows}

    try:
        pdf_bytes = pdf_integration.render_challan_document_pdf(challan, quotation, balances)
    except pdf_integration.PdfUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    name = (challan.challan_number or f"challan-draft-{challan.id[:8]}").replace("/", "-")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'},
    )


@router.patch("/challans/{challan_id}", response_model=ChallanOut)
async def update_challan(
    challan_id: str, payload: ChallanUpdate, db: DbSession, session: AdminSession = ChallansArea
):
    challan = await svc.get_challan(db, challan_id)
    if challan is None:
        raise HTTPException(status_code=404, detail="Challan not found.")
    if challan.status != "pending":
        raise HTTPException(
            status_code=409, detail="Only a pending challan can be edited."
        )

    quotation = await ops.get_quotation(db, challan.quotation_id)
    try:
        updated = await svc.update_challan(
            db,
            challan,
            quotation,
            lines=(
                [l.model_dump(by_alias=True) for l in payload.lines]
                if payload.lines is not None
                else None
            ),
            delivery_address=payload.delivery_address,
            remarks=payload.remarks,
        )
    except svc.OverDelivery as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _challan_out(updated, quotation)


@router.post("/challans/{challan_id}/approve", response_model=ChallanOut)
async def approve_challan(challan_id: str, db: DbSession, session: AdminSession = ChallansArea):
    challan = await svc.get_challan(db, challan_id)
    if challan is None:
        raise HTTPException(status_code=404, detail="Challan not found.")
    quotation = await ops.get_quotation(db, challan.quotation_id)
    details = (quotation.details or {}) if quotation else {}
    updated = await svc.approve_challan(db, challan, details.get("companyName") or "")
    logger.info("%s approved challan %s", session.email, updated.challan_number)
    return _challan_out(updated, quotation)


@router.post("/challans/{challan_id}/dispatch", response_model=ChallanOut)
async def dispatch_challan(
    challan_id: str, payload: ChallanDispatch, db: DbSession, session: AdminSession = ChallansArea
):
    challan = await svc.get_challan(db, challan_id)
    if challan is None:
        raise HTTPException(status_code=404, detail="Challan not found.")
    if challan.challan_number is None:
        raise HTTPException(
            status_code=400, detail="Approve the challan before dispatching it."
        )

    updated = await svc.dispatch_challan(
        db,
        challan,
        vehicle_number=payload.vehicle_number,
        driver_info=payload.driver_info,
        receiver_name=payload.receiver_name,
        remarks=payload.remarks,
    )
    quotation = await ops.get_quotation(db, updated.quotation_id)
    return _challan_out(updated, quotation)


@router.post("/challans/{challan_id}/deliver", response_model=ChallanOut)
async def deliver_challan(
    challan_id: str,
    db: DbSession,
    file: UploadFile | None = File(default=None),
    session: AdminSession = ChallansArea,
):
    """Marks delivery confirmed, optionally attaching the customer's signed copy."""
    challan = await svc.get_challan(db, challan_id)
    if challan is None:
        raise HTTPException(status_code=404, detail="Challan not found.")

    url = None
    if file is not None:
        content = await file.read()
        try:
            ext = validate_document(file.filename or "", content, file.content_type)
            url = save_image(
                f"documents/challans/{safe_filename(challan_id)}{ext}",
                content,
                file.content_type,
            )
        except ImageRejected as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated = await svc.deliver_challan(db, challan, signed_document_url=url)
    quotation = await ops.get_quotation(db, updated.quotation_id)

    # Stage only advances once the order is fully shipped AND fully paid —
    # see advance_stage_if_fulfilled. A delivered-but-unpaid order stays at
    # Pending so the dot meter still flags the outstanding payment.
    if quotation is not None:
        await ops.advance_stage_if_fulfilled(db, quotation)
        quotation = await ops.get_quotation(db, updated.quotation_id)

    return _challan_out(updated, quotation)


@router.patch("/challans/{challan_id}/status", response_model=ChallanOut)
async def set_challan_status(
    challan_id: str, payload: ChallanStatusUpdate, db: DbSession, session: AdminSession = ChallansArea
):
    challan = await svc.get_challan(db, challan_id)
    if challan is None:
        raise HTTPException(status_code=404, detail="Challan not found.")
    try:
        updated = await svc.set_challan_status(db, challan, payload.status)
    except svc.TransitionRefused as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    quotation = await ops.get_quotation(db, updated.quotation_id)
    if quotation is not None:
        await ops.advance_stage_if_fulfilled(db, quotation)
        quotation = await ops.get_quotation(db, updated.quotation_id)
    return _challan_out(updated, quotation)
