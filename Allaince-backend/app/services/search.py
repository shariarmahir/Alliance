from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Order, Product, Quotation
from app.schemas.analytics import SearchResult
from app.schemas.session import AdminSession

# Per type, so one noisy category cannot crowd out the others.
PER_TYPE_LIMIT = 5


def _matches(haystack: list[str | None], needle: str) -> bool:
    return any(value and needle in value.lower() for value in haystack)


async def search_admin(db: AsyncSession, raw_query: str, session: AdminSession) -> list[SearchResult]:
    """RBAC-scoped unified search.

    Results are filtered by the viewer's grants, so a sub-admin never sees a
    result they would be blocked from opening.
    """
    query = (raw_query or "").strip().lower()
    # Single characters match almost everything — not worth the round trip.
    if len(query) < 2:
        return []

    access = session.access_options or []

    def can_see(area: str) -> bool:
        return session.role == "super" or area in access

    results: list[SearchResult] = []

    # Products are open to any authenticated admin.
    products = list((await db.execute(select(Product))).scalars().all())
    for product in products:
        if len([r for r in results if r.type == "product"]) >= PER_TYPE_LIMIT:
            break
        if _matches([product.name, product.part_number, product.brand], query):
            results.append(
                SearchResult(
                    type="product",
                    id=product.slug,
                    title=product.name,
                    subtitle=product.part_number,
                    href=f"/admin/products?q={quote(product.part_number)}",
                )
            )

    if can_see("orders"):
        orders = list((await db.execute(select(Order))).scalars().all())
        for order in orders:
            if len([r for r in results if r.type == "order"]) >= PER_TYPE_LIMIT:
                break
            if _matches([order.order_number, order.tracking_id, order.customer_name], query):
                results.append(
                    SearchResult(
                        type="order",
                        id=order.order_number,
                        title=order.order_number,
                        subtitle=f"{order.customer_name or 'Unknown'} · {order.status}",
                        href=f"/admin/orders?q={quote(order.order_number)}",
                    )
                )

    if can_see("quotations"):
        quotations = list((await db.execute(select(Quotation))).scalars().all())
        for quotation in quotations:
            if len([r for r in results if r.type == "quotation"]) >= PER_TYPE_LIMIT:
                break
            details = quotation.details or {}
            ref = quotation.confirmation.ref_number if quotation.confirmation else None
            if _matches(
                [ref, details.get("companyName"), details.get("fullName"), details.get("email")],
                query,
            ):
                results.append(
                    SearchResult(
                        type="quotation",
                        id=quotation.id,
                        title=ref or f"Request from {details.get('companyName', 'customer')}",
                        subtitle=f"{details.get('fullName', '')} · {quotation.status}",
                        href=f"/admin/quotations?q={quote(details.get('email', ''))}",
                    )
                )

        # Clients are derived from quotation contact details, deduped by email
        # so one company with several requests appears once.
        seen: set[str] = set()
        for quotation in quotations:
            if len(seen) >= PER_TYPE_LIMIT:
                break
            details = quotation.details or {}
            email = (details.get("email") or "").lower()
            if not email or email in seen:
                continue
            if _matches([details.get("fullName"), email, details.get("companyName")], query):
                seen.add(email)
                results.append(
                    SearchResult(
                        type="client",
                        id=email,
                        title=details.get("fullName") or details.get("companyName", ""),
                        subtitle=f"{details.get('companyName', '')} · {details.get('email', '')}",
                        href=f"/admin/quotations?q={quote(email)}",
                    )
                )

    return results
