import base64
import binascii
import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.core.deps import DbSession, SuperAdminDep, require_area
from app.integrations import email as email_integration
from app.integrations import pdf as pdf_integration
from app.schemas.operations import (
    ConfirmQuotationRequest,
    ContactRequestOut,
    DeliveryStageUpdate,
    HandledUpdate,
    OrderOut,
    OrderStatusUpdate,
    QuotationEmailRequest,
    QuotationOut,
    QuotationStatusUpdate,
)
from app.schemas.session import AdminSession
from app.services import operations as svc

logger = logging.getLogger("app.admin_operations")

# Resend's own ceiling is 40MB across the whole message; a quotation PDF is
# tens of kilobytes, so anything approaching this is a bug or an abuse attempt
# rather than a real offer.
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

router = APIRouter(prefix="/api/admin", tags=["admin-operations"])

# Each operations surface is delegable: a super admin passes unconditionally,
# a sub-admin only with that specific area granted.
QuotationsArea = Depends(require_area("quotations"))
OrdersArea = Depends(require_area("orders"))
ContactArea = Depends(require_area("contact-requests"))


def _decode_pdf(pdf_base64: str | None) -> bytes | None:
    """Validates a browser-rendered PDF before it becomes a mail attachment.

    Anything reaching here was posted by a client, so it is checked rather
    than trusted: valid base64, actually a PDF, and within the size a mail
    provider will accept.
    """
    if not pdf_base64:
        return None
    try:
        pdf_bytes = base64.b64decode(pdf_base64, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise HTTPException(
            status_code=422, detail="The attached PDF was not valid base64."
        ) from exc
    if not pdf_bytes.startswith(b"%PDF-"):
        raise HTTPException(status_code=422, detail="The attached file is not a PDF.")
    if len(pdf_bytes) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"The PDF exceeds the "
            f"{MAX_ATTACHMENT_BYTES // (1024 * 1024)}MB attachment limit.",
        )
    return pdf_bytes


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


@router.delete("/quotations/cancelled", status_code=status.HTTP_200_OK)
async def clear_cancelled_quotations(db: DbSession, session: SuperAdminDep):
    """Permanently deletes every cancelled quotation.

    Super admin only, not the quotations area grant that covers the rest of
    this router: the other routes act on one record and are reversible, while
    this destroys many at once with nothing to undo it.

    Declared before /quotations/{quotation_id} would otherwise be a concern,
    but that route is a PATCH and this is a DELETE, so there is no collision.
    """
    removed = await svc.delete_cancelled_quotations(db)
    logger.info("%s cleared %d cancelled quotation(s)", session.email, removed)
    return {"removed": removed}


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
        confirm=payload.confirm,
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

    was = svc.clamp_stage(quotation.confirmation.delivery_stage)
    updated = await svc.update_delivery_stage(
        db, quotation.confirmation.tracking_id, payload.stage
    )
    now = svc.clamp_stage(updated.confirmation.delivery_stage)

    # Only on the transition into the confirmed stage — re-selecting the value
    # it already holds must not send the customer a duplicate.
    if now == svc.MAX_STAGE and was != svc.MAX_STAGE:
        try:
            await email_integration.send_order_confirmed(updated)
        except Exception:
            # The stage change is saved and correct; a mail failure must not
            # roll it back or surface as a failed action.
            logger.exception("Failed to send order-confirmed email for %s", quotation_id)

    return _out(updated)


@router.post("/quotations/{quotation_id}/email")
async def email_quotation(
    quotation_id: str,
    db: DbSession,
    payload: QuotationEmailRequest | None = None,
    session: AdminSession = QuotationsArea,
):
    """Sends the issued offer to the customer with the PDF attached.

    The attachment is normally the PDF the admin's browser rendered and posted
    here, so the customer receives byte-for-byte the document the admin saw and
    could have downloaded. The server can render its own, but that generator
    produces a plainer layout, so it is only a fallback for a caller that sends
    nothing.
    """
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    if quotation.confirmation is None:
        raise HTTPException(
            status_code=400, detail="Issue the confirmation before emailing it."
        )

    pdf_bytes = _decode_pdf(payload.pdf_base64 if payload else None)

    if pdf_bytes is None:
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


@router.post("/quotations/{quotation_id}/challan/email")
async def email_challan(
    quotation_id: str,
    db: DbSession,
    payload: QuotationEmailRequest | None = None,
    session: AdminSession = OrdersArea,
):
    """Emails the delivery challan the admin's browser rendered.

    Guarded by the orders grant rather than quotations: a challan belongs to
    fulfilling an accepted order, not to pricing a request. There is no
    server-side fallback renderer — the challan layout exists only in the
    browser builder, so a caller that sends nothing gets a clear error rather
    than an email with a document that does not match what they saw.
    """
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    if quotation.confirmation is None:
        raise HTTPException(
            status_code=400, detail="Confirm the order before sending a challan."
        )

    pdf_bytes = _decode_pdf(payload.pdf_base64 if payload else None)
    if pdf_bytes is None:
        raise HTTPException(status_code=422, detail="No challan PDF was supplied.")

    sent = await email_integration.send_challan(quotation, pdf_bytes)
    if not sent:
        raise HTTPException(
            status_code=502, detail="Email could not be sent. Check the mail configuration."
        )
    logger.info("%s emailed challan for %s", session.email, quotation_id)
    return {"sent": True, "attached": True}


@router.post("/quotations/{quotation_id}/invoice/email")
async def email_invoice(
    quotation_id: str,
    db: DbSession,
    payload: QuotationEmailRequest | None = None,
    session: AdminSession = OrdersArea,
):
    """Emails the invoice the admin's browser rendered.

    Same reasoning as the challan route: the invoice is the quotation layout
    retitled, and only the browser builder produces it, so a caller that
    supplies no PDF is an error rather than a cue to render something else.
    """
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    if quotation.confirmation is None:
        raise HTTPException(
            status_code=400, detail="Confirm the order before sending an invoice."
        )

    pdf_bytes = _decode_pdf(payload.pdf_base64 if payload else None)
    if pdf_bytes is None:
        raise HTTPException(status_code=422, detail="No invoice PDF was supplied.")

    sent = await email_integration.send_invoice(quotation, pdf_bytes)
    if not sent:
        raise HTTPException(
            status_code=502, detail="Email could not be sent. Check the mail configuration."
        )
    logger.info("%s emailed invoice for %s", session.email, quotation_id)
    return {"sent": True, "attached": True}


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
