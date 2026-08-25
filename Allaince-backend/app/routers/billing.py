import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.deps import DbSession, require_area
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
    InvoiceCreate,
    InvoiceOut,
    InvoicePaymentIn,
    InvoiceStatusUpdate,
    InvoiceUpdate,
    OrderBalanceLine,
)
from app.schemas.session import AdminSession
from app.services import billing as svc
from app.services import operations as ops

logger = logging.getLogger("app.billing")

router = APIRouter(prefix="/api/admin", tags=["billing"])

# Invoices and challans belong to fulfilling an accepted order, so they sit
# behind the orders grant rather than quotations.
OrdersArea = Depends(require_area("orders"))


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
    session: AdminSession = OrdersArea,
):
    """What is ordered, delivered, invoiced and still outstanding per line.

    This is what the prepare screens read to stop an admin over-shipping or
    double-billing, so it is derived on every call rather than cached.
    """
    quotation = await _confirmed_order(db, quotation_id)
    rows = await svc.order_balances(db, quotation, exclude_challan=exclude_challan)
    return [OrderBalanceLine.model_validate(r) for r in rows]


# --- Invoices ---------------------------------------------------------------


@router.get("/invoices", response_model=list[InvoiceOut])
async def list_invoices(
    db: DbSession, status_filter: str | None = None, session: AdminSession = OrdersArea
):
    invoices = await svc.list_invoices(db, status=status_filter)
    out: list[InvoiceOut] = []
    for invoice in invoices:
        quotation = await ops.get_quotation(db, invoice.quotation_id)
        if quotation is not None:
            out.append(_invoice_out(invoice, quotation))
    return out


@router.post("/invoices", response_model=InvoiceOut, status_code=status.HTTP_201_CREATED)
async def create_invoice(payload: InvoiceCreate, db: DbSession, session: AdminSession = OrdersArea):
    quotation = await _confirmed_order(db, payload.quotation_id)
    invoice = await svc.create_invoice(
        db,
        quotation,
        lines=[l.model_dump(by_alias=True) for l in payload.lines],
        discount=payload.discount,
        tax_rate=payload.tax_rate,
        other_charges=payload.other_charges,
        notes=payload.notes,
    )
    logger.info("%s prepared an invoice for %s", session.email, quotation.id)
    return _invoice_out(invoice, quotation)


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(invoice_id: str, db: DbSession, session: AdminSession = OrdersArea):
    invoice = await svc.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    quotation = await ops.get_quotation(db, invoice.quotation_id)
    return _invoice_out(invoice, quotation)


@router.patch("/invoices/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(
    invoice_id: str, payload: InvoiceUpdate, db: DbSession, session: AdminSession = OrdersArea
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

    updated = await svc.update_invoice(
        db,
        invoice,
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
    quotation = await ops.get_quotation(db, updated.quotation_id)
    return _invoice_out(updated, quotation)


@router.post("/invoices/{invoice_id}/approve", response_model=InvoiceOut)
async def approve_invoice(invoice_id: str, db: DbSession, session: AdminSession = OrdersArea):
    invoice = await svc.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    quotation = await ops.get_quotation(db, invoice.quotation_id)
    details = (quotation.details or {}) if quotation else {}
    updated = await svc.approve_invoice(db, invoice, details.get("companyName") or "")
    logger.info("%s approved invoice %s", session.email, updated.invoice_number)
    return _invoice_out(updated, quotation)


@router.post("/invoices/{invoice_id}/payments", response_model=InvoiceOut)
async def add_payment(
    invoice_id: str, payload: InvoicePaymentIn, db: DbSession, session: AdminSession = OrdersArea
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
    return _invoice_out(updated, quotation)


@router.patch("/invoices/{invoice_id}/status", response_model=InvoiceOut)
async def set_invoice_status(
    invoice_id: str, payload: InvoiceStatusUpdate, db: DbSession, session: AdminSession = OrdersArea
):
    invoice = await svc.get_invoice(db, invoice_id)
    if invoice is None:
        raise HTTPException(status_code=404, detail="Invoice not found.")
    updated = await svc.set_invoice_status(db, invoice, payload.status)
    quotation = await ops.get_quotation(db, updated.quotation_id)
    return _invoice_out(updated, quotation)


# --- Challans ---------------------------------------------------------------


@router.get("/challans", response_model=list[ChallanOut])
async def list_challans(
    db: DbSession, status_filter: str | None = None, session: AdminSession = OrdersArea
):
    challans = await svc.list_challans(db, status=status_filter)
    out: list[ChallanOut] = []
    for challan in challans:
        quotation = await ops.get_quotation(db, challan.quotation_id)
        if quotation is not None:
            out.append(_challan_out(challan, quotation))
    return out


@router.post("/challans", response_model=ChallanOut, status_code=status.HTTP_201_CREATED)
async def create_challan(payload: ChallanCreate, db: DbSession, session: AdminSession = OrdersArea):
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
async def get_challan(challan_id: str, db: DbSession, session: AdminSession = OrdersArea):
    challan = await svc.get_challan(db, challan_id)
    if challan is None:
        raise HTTPException(status_code=404, detail="Challan not found.")
    quotation = await ops.get_quotation(db, challan.quotation_id)
    return _challan_out(challan, quotation)


@router.patch("/challans/{challan_id}", response_model=ChallanOut)
async def update_challan(
    challan_id: str, payload: ChallanUpdate, db: DbSession, session: AdminSession = OrdersArea
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
async def approve_challan(challan_id: str, db: DbSession, session: AdminSession = OrdersArea):
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
    challan_id: str, payload: ChallanDispatch, db: DbSession, session: AdminSession = OrdersArea
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
    session: AdminSession = OrdersArea,
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

    # The order's own delivery is complete once every line has shipped, which
    # is derived rather than set by hand so a later cancellation reopens it.
    if quotation is not None and await svc.delivery_is_complete(db, quotation):
        await ops.update_delivery_stage(
            db, quotation.confirmation.tracking_id, ops.MAX_STAGE
        )
        logger.info("Order %s fully delivered", quotation.id)

    return _challan_out(updated, quotation)


@router.patch("/challans/{challan_id}/status", response_model=ChallanOut)
async def set_challan_status(
    challan_id: str, payload: ChallanStatusUpdate, db: DbSession, session: AdminSession = OrdersArea
):
    challan = await svc.get_challan(db, challan_id)
    if challan is None:
        raise HTTPException(status_code=404, detail="Challan not found.")
    updated = await svc.set_challan_status(db, challan, payload.status)
    quotation = await ops.get_quotation(db, updated.quotation_id)
    return _challan_out(updated, quotation)
