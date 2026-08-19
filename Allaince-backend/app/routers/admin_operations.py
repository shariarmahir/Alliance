import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.deps import DbSession, require_area
from app.integrations import email as email_integration
from app.integrations import pdf as pdf_integration
from app.schemas.operations import (
    ConfirmQuotationRequest,
    ContactRequestOut,
    DeliveryStageUpdate,
    HandledUpdate,
    OrderOut,
    OrderStatusUpdate,
    QuotationOut,
    QuotationStatusUpdate,
)
from app.schemas.session import AdminSession
from app.services import operations as svc

logger = logging.getLogger("app.admin_operations")

router = APIRouter(prefix="/api/admin", tags=["admin-operations"])

# Each operations surface is delegable: a super admin passes unconditionally,
# a sub-admin only with that specific area granted.
QuotationsArea = Depends(require_area("quotations"))
OrdersArea = Depends(require_area("orders"))
ContactArea = Depends(require_area("contact-requests"))


def _out(quotation) -> QuotationOut:
    return QuotationOut.model_validate(
        {
            "id": quotation.id,
            "items": quotation.items,
            "total": quotation.total,
            "details": quotation.details,
            "status": quotation.status,
            "confirmation": quotation.confirmation,
        }
    )


# --- Quotations -------------------------------------------------------------


@router.get("/quotations", response_model=list[QuotationOut])
async def list_quotations(
    db: DbSession, status_filter: str | None = None, session: AdminSession = QuotationsArea
):
    return [_out(q) for q in await svc.list_quotations(db, status=status_filter)]


@router.get("/quotations/{quotation_id}", response_model=QuotationOut)
async def get_quotation(
    quotation_id: str, db: DbSession, session: AdminSession = QuotationsArea
):
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    return _out(quotation)


@router.patch("/quotations/{quotation_id}/status", response_model=QuotationOut)
async def update_quotation_status(
    quotation_id: str,
    payload: QuotationStatusUpdate,
    db: DbSession,
    session: AdminSession = QuotationsArea,
):
    quotation = await svc.update_quotation_status(db, quotation_id, payload.status)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    return _out(quotation)


@router.post("/quotations/{quotation_id}/confirm", response_model=QuotationOut)
async def confirm_quotation(
    quotation_id: str,
    payload: ConfirmQuotationRequest,
    db: DbSession,
    session: AdminSession = QuotationsArea,
):
    quotation = await svc.confirm_quotation(
        db,
        quotation_id,
        lines=[line.model_dump(by_alias=True) for line in payload.lines],
        terms=payload.terms.model_dump(by_alias=True),
        ref_number=payload.ref_number,
        subject=payload.subject,
        issued_date=payload.issued_date,
    )
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    return _out(quotation)


@router.patch("/quotations/{quotation_id}/delivery", response_model=QuotationOut)
async def update_delivery(
    quotation_id: str,
    payload: DeliveryStageUpdate,
    db: DbSession,
    session: AdminSession = OrdersArea,
):
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None or quotation.confirmation is None:
        raise HTTPException(status_code=404, detail="No issued confirmation for this quotation.")
    updated = await svc.update_delivery_stage(
        db, quotation.confirmation.tracking_id, payload.stage
    )
    return _out(updated)


@router.post("/quotations/{quotation_id}/email")
async def email_quotation(
    quotation_id: str, db: DbSession, session: AdminSession = QuotationsArea
):
    """Sends the issued offer to the customer with the PDF attached."""
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    if quotation.confirmation is None:
        raise HTTPException(
            status_code=400, detail="Issue the confirmation before emailing it."
        )

    pdf_bytes = None
    try:
        pdf_bytes = pdf_integration.render_quotation_pdf(quotation)
    except pdf_integration.PdfUnavailable:
        # Send without the attachment rather than failing the whole action.
        logger.warning("PDF rendering unavailable; emailing without attachment.")

    sent = await email_integration.send_quotation_issued(quotation, pdf_bytes)
    if not sent:
        raise HTTPException(
            status_code=502, detail="Email could not be sent. Check the mail configuration."
        )
    return {"sent": True, "attached": pdf_bytes is not None}


@router.get("/quotations/{quotation_id}/pdf")
async def quotation_pdf(
    quotation_id: str, db: DbSession, session: AdminSession = QuotationsArea
):
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    try:
        pdf_bytes = pdf_integration.render_quotation_pdf(quotation)
    except pdf_integration.PdfUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    ref = quotation.confirmation.ref_number if quotation.confirmation else quotation.id
    filename = f"{str(ref).replace('/', '-')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- Orders -----------------------------------------------------------------


@router.get("/orders", response_model=list[OrderOut])
async def list_orders(db: DbSession, session: AdminSession = OrdersArea):
    return [OrderOut.model_validate(o) for o in await svc.list_orders(db)]


@router.patch("/orders/{order_number}/status", response_model=OrderOut)
async def update_order_status(
    order_number: str,
    payload: OrderStatusUpdate,
    db: DbSession,
    session: AdminSession = OrdersArea,
):
    order = await svc.update_order_status(db, order_number, payload.status)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    return OrderOut.model_validate(order)


@router.get("/orders/{order_number}/invoice")
async def order_invoice(
    order_number: str, db: DbSession, session: AdminSession = OrdersArea
):
    order = await svc.get_order(db, order_number)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found.")
    try:
        pdf_bytes = pdf_integration.render_invoice_pdf(order)
    except pdf_integration.PdfUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{order.order_number}.pdf"'},
    )


# --- Contact requests -------------------------------------------------------


@router.get("/contact-requests", response_model=list[ContactRequestOut])
async def list_contact_requests(db: DbSession, session: AdminSession = ContactArea):
    return [ContactRequestOut.model_validate(c) for c in await svc.list_contact_requests(db)]


@router.patch("/contact-requests/{request_id}/handled", response_model=ContactRequestOut)
async def mark_handled(
    request_id: str,
    payload: HandledUpdate,
    db: DbSession,
    session: AdminSession = ContactArea,
):
    request = await svc.mark_contact_request_handled(db, request_id, payload.handled)
    if request is None:
        raise HTTPException(status_code=404, detail="Contact request not found.")
    return ContactRequestOut.model_validate(request)
