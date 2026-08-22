import logging

from fastapi import APIRouter, HTTPException, Request, status

from app.core.deps import DbSession
from app.core.rate_limit import check_rate_limit, client_key
from app.integrations import email as email_integration
from app.schemas.operations import (
    ContactRequestCreate,
    ContactRequestOut,
    OrderCreate,
    OrderOut,
    QuotationCreate,
    QuotationOut,
)
from app.services import operations as svc

logger = logging.getLogger("app.operations")

# Public, unauthenticated storefront writes. Each one is rate limited, since
# anyone on the internet can reach them.
router = APIRouter(prefix="/api", tags=["operations"])


def _throttle(request: Request, prefix: str, limit: int, window: int):
    async def _run():
        result = await check_rate_limit(client_key(request, prefix), limit, window)
        if not result.ok:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please wait a moment and try again.",
                headers={"Retry-After": str(result.retry_after_seconds)},
            )

    return _run()


def _to_quotation_out(quotation) -> QuotationOut:
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


@router.post("/quotations", response_model=QuotationOut, status_code=status.HTTP_201_CREATED)
async def submit_quotation(payload: QuotationCreate, request: Request, db: DbSession):
    await _throttle(request, "quotations", limit=10, window=600)

    quotation = await svc.add_quotation(
        db,
        [item.model_dump(by_alias=True) for item in payload.items],
        payload.details.model_dump(by_alias=True, mode="json"),
    )
    # Notification failure must not lose the customer's request — it is
    # already committed, so log and carry on.
    try:
        await email_integration.notify_new_quotation(quotation)
    except Exception:
        logger.exception("Failed to send new-quotation notification for %s", quotation.id)

    return _to_quotation_out(quotation)


@router.get("/quotations/{quotation_id}", response_model=QuotationOut)
async def get_quotation(quotation_id: str, db: DbSession):
    """Polled by the customer's status page. The UUID is the capability —
    unguessable, and it exposes only that customer's own document."""
    quotation = await svc.get_quotation(db, quotation_id)
    if quotation is None:
        raise HTTPException(status_code=404, detail="Quotation not found.")
    return _to_quotation_out(quotation)


@router.post("/orders", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(payload: OrderCreate, request: Request, db: DbSession):
    await _throttle(request, "orders", limit=10, window=600)
    order = await svc.add_order(db, payload.model_dump())
    return OrderOut.model_validate(order)


@router.post("/contact", response_model=ContactRequestOut, status_code=status.HTTP_201_CREATED)
async def submit_contact(payload: ContactRequestCreate, request: Request, db: DbSession):
    await _throttle(request, "contact", limit=5, window=600)
    contact = await svc.add_contact_request(db, payload.model_dump())
    try:
        await email_integration.notify_new_contact(contact)
    except Exception:
        logger.exception("Failed to send contact notification for %s", contact.id)
    return ContactRequestOut.model_validate(contact)


