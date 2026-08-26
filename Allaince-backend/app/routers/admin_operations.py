import base64
import binascii
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status

from app.core.deps import DbSession, SuperAdminDep, require_area
from app.integrations import email as email_integration
from app.integrations import pdf as pdf_integration
from app.integrations.object_storage import (
    ImageRejected,
    save_image,
    validate_document,
    work_order_key,
)
from app.schemas.operations import (
    ConfirmQuotationRequest,
    ContactRequestOut,
    DeletedOrderOut,
    DeliveryStageUpdate,
    HandledUpdate,
    PurgeQuotationRequest,
    OrderOut,
    OrderStatusUpdate,
    PaymentStatusUpdate,
    QuotationEmailRequest,
    QuotationOut,
    QuotationStatusUpdate,
    WorkOrderUpdate,
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


async def _derived(db, quotation) -> dict:
    """Delivery completion and the payment position, both computed from the
    documents raised against the order rather than stored beside it."""
    if quotation.confirmation is None:
        return {}
    return {
        "delivery_complete": await svc.delivered_in_full(db, quotation),
        **await svc.payment_position(db, quotation),
    }


def _out(quotation, *, derived: dict | None = None) -> QuotationOut:
    """`derived` carries fields computed from other tables -- delivery
    completion and the payment position -- which callers with a DB session
    supply. Callers without one omit them and get the schema defaults rather
    than claiming a position they have not checked."""
    confirmation = quotation.confirmation
    if confirmation is not None and derived:
        # Pydantic reads these off the ORM object, which has no such columns.
        confirmation = {
            **{c.name: getattr(confirmation, c.name)
               for c in confirmation.__table__.columns},
            **derived,
        }
    return QuotationOut.model_validate(
        {
            "id": quotation.id,
            "items": quotation.items,
            "total": quotation.total,
            "details": quotation.details,
            "status": quotation.status,
            "confirmation": confirmation,
            "quoted_sent_at": quotation.quoted_sent_at,
            "po_document_url": quotation.po_document_url,
            "po_number": quotation.po_number,
            "po_uploaded_at": quotation.po_uploaded_at,
        }
    )


# --- Quotations -------------------------------------------------------------


@router.get("/quotations", response_model=list[QuotationOut])
async def list_quotations(
    db: DbSession, status_filter: str | None = None, session: AdminSession = QuotationsArea
):
    rows = await svc.list_quotations(db, status=status_filter)
    # One query per confirmed order rather than a join: the Orders screen
    # needs Section B's Completed state per row, and only confirmed rows can
    # have challans at all.
    return [_out(q, derived=await _derived(db, q)) for q in rows]


@router.get("/quotations/{quotation_id}", response_model=QuotationOut)
async def get_quotation(
    quotation_id: str, db: DbSession, session: AdminSession = QuotationsArea
):
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    return _out(quotation, derived=await _derived(db, quotation))


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
    try:
        quotation = await svc.update_quotation_status(db, quotation_id, payload.status)
    except svc.ConfirmationInUse as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    return _out(quotation)


@router.get("/deleted-orders", response_model=list[DeletedOrderOut])
async def list_deleted_orders(db: DbSession, session: SuperAdminDep):
    """The audit trail of purged orders, and the source of the deleted-revenue
    chart. Super admin only, matching who is allowed to create these."""
    return await svc.list_deleted_orders(db)


@router.delete("/quotations/{quotation_id}", response_model=DeletedOrderOut)
async def purge_quotation(
    quotation_id: str,
    payload: PurgeQuotationRequest,
    db: DbSession,
    session: SuperAdminDep,
):
    """Destroys an order and every invoice, challan and receipt against it.

    Deliberately a DELETE on the quotation itself rather than another status
    value: this is not a state the order moves into, it is the order ceasing
    to exist, and modelling it as a status would put "destroy everything"
    one dropdown selection away from an ordinary edit.

    Super admin only. Sub-admins with the quotations area keep the ordinary
    cancel, which still refuses while paperwork stands -- irreversibly
    destroying financial records is not a routine delegated permission.
    """
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")

    stub = await svc.purge_quotation(
        db, quotation, deleted_by=session.email, reason=payload.reason
    )
    # Logged at warning: this is the one operation here with nothing to undo
    # it, and the amounts are what make it worth finding in a log later.
    logger.warning(
        "%s purged order %s (%s) - invoiced %.2f, received %.2f, %d invoice(s), %d challan(s)",
        session.email,
        stub.ref_number or quotation_id,
        stub.company_name,
        stub.amount_invoiced,
        stub.amount_received,
        stub.invoice_count,
        stub.challan_count,
    )
    return stub


@router.post("/quotations/{quotation_id}/confirm", response_model=QuotationOut)
async def confirm_quotation(
    quotation_id: str,
    payload: ConfirmQuotationRequest,
    db: DbSession,
    session: AdminSession = QuotationsArea,
):
    try:
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
    except svc.WorkflowRefused as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
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


@router.patch("/quotations/{quotation_id}/payment", response_model=QuotationOut)
async def update_payment(
    quotation_id: str,
    payload: PaymentStatusUpdate,
    db: DbSession,
    session: AdminSession = OrdersArea,
):
    """Records payment against a confirmed order.

    No customer email here, deliberately: the money receipt is the document
    that acknowledges payment, and an admin sends it when they choose to.
    """
    updated = await svc.update_payment_status(db, quotation_id, payload.status)
    if updated is None:
        raise HTTPException(
            status_code=404, detail="No issued confirmation for this quotation."
        )
    logger.info("%s marked payment %s for %s", session.email, payload.status, quotation_id)
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

    # Only after a confirmed send: "submitted" has to mean the customer
    # actually received it, so a mail failure must leave the status alone.
    await svc.mark_quotation_submitted(db, quotation_id)
    return {"sent": True, "attached": pdf_bytes is not None}


@router.patch("/quotations/{quotation_id}/work-order", response_model=QuotationOut)
async def set_work_order_number(
    quotation_id: str,
    payload: WorkOrderUpdate,
    db: DbSession,
    session: AdminSession = QuotationsArea,
):
    """Records the customer's PO number, which usually arrives before the file."""
    updated = await svc.record_work_order(db, quotation_id, po_number=payload.po_number)
    if updated is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    return _out(updated)


@router.post("/quotations/{quotation_id}/work-order", response_model=QuotationOut)
async def upload_work_order(
    quotation_id: str,
    db: DbSession,
    file: UploadFile = File(...),
    po_number: str = Form(default=""),
    session: AdminSession = QuotationsArea,
):
    """Attaches the customer's signed Work Order / PO document.

    Keyed on the quotation id, so re-uploading a corrected PO replaces the
    previous file rather than accumulating orphans nothing links to.
    """
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")

    content = await file.read()
    try:
        ext = validate_document(file.filename or "", content, file.content_type)
        url = save_image(work_order_key(quotation_id, ext), content, file.content_type)
    except ImageRejected as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    updated = await svc.record_work_order(
        db,
        quotation_id,
        po_number=po_number or None,
        document_url=url,
    )
    logger.info("%s uploaded a work order for %s", session.email, quotation_id)
    return _out(updated)


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


@router.post("/quotations/{quotation_id}/receipt/email")
async def email_receipt(
    quotation_id: str,
    db: DbSession,
    payload: QuotationEmailRequest | None = None,
    session: AdminSession = OrdersArea,
):
    """Emails the money receipt the admin's browser rendered.

    Refuses unless payment is actually recorded as received: a receipt is
    proof money changed hands, and sending one for an unpaid order is a
    claim the business cannot support. The UI hides the action in that
    state, but the rule belongs here too — the UI is not the guard.
    """
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    if quotation.confirmation is None:
        raise HTTPException(
            status_code=400, detail="Confirm the order before sending a receipt."
        )
    if quotation.confirmation.payment_status != "received":
        raise HTTPException(
            status_code=400,
            detail="Mark the payment received before sending a receipt.",
        )

    pdf_bytes = _decode_pdf(payload.pdf_base64 if payload else None)
    if pdf_bytes is None:
        raise HTTPException(status_code=422, detail="No receipt PDF was supplied.")

    sent = await email_integration.send_receipt(quotation, pdf_bytes)
    if not sent:
        raise HTTPException(
            status_code=502, detail="Email could not be sent. Check the mail configuration."
        )
    logger.info("%s emailed receipt for %s", session.email, quotation_id)
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
