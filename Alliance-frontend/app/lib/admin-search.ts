import "server-only";
import { readProducts } from "./admin-catalog";
import { readOrders, readQuotations } from "./admin-operations";
import type { AccessArea, AdminSession } from "./types";

// Backs the admin topbar's search. Scoped by the viewer's RBAC grants — the
// same rule the sidebar counts and proxy.ts use — so a sub-admin never sees a
// result they would be redirected away from on click.

export type SearchResultType = "order" | "quotation" | "product" | "client";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

// Per type, so one noisy category cannot crowd out the others.
const PER_TYPE_LIMIT = 5;

function matches(haystack: (string | undefined)[], needle: string): boolean {
  return haystack.some((value) => value?.toLowerCase().includes(needle));
}

export async function searchAdmin(
  rawQuery: string,
  session: AdminSession
): Promise<SearchResult[]> {
  const query = rawQuery.trim().toLowerCase();
  // Single characters match almost everything — not worth the round trip.
  if (query.length < 2) return [];

  const accessOptions = session.accessOptions ?? [];
  const canSee = (area: AccessArea) => session.role === "super" || accessOptions.includes(area);

  // Products are open to any authenticated admin (see proxy.ts's
  // SUB_ADMIN_ALLOWED_PREFIXES); the operational records are gated per area.
  const [products, orders, quotations] = await Promise.all([
    readProducts(),
    canSee("orders") ? readOrders() : [],
    canSee("quotations") ? readQuotations() : [],
  ]);

  const results: SearchResult[] = [];

  for (const product of products) {
    if (results.filter((r) => r.type === "product").length >= PER_TYPE_LIMIT) break;
    if (matches([product.name, product.partNumber, product.brand], query)) {
      results.push({
        type: "product",
        id: product.slug,
        title: product.name,
        subtitle: product.partNumber,
        href: `/admin/products?q=${encodeURIComponent(product.partNumber)}`,
      });
    }
  }

  for (const order of orders) {
    if (results.filter((r) => r.type === "order").length >= PER_TYPE_LIMIT) break;
    if (matches([order.orderNumber, order.trackingId, order.address?.name], query)) {
      results.push({
        type: "order",
        id: order.orderNumber,
        title: order.orderNumber,
        subtitle: `${order.address?.name ?? "Unknown"} · ${order.status}`,
        href: `/admin/orders?q=${encodeURIComponent(order.orderNumber)}`,
      });
    }
  }

  for (const quotation of quotations) {
    if (results.filter((r) => r.type === "quotation").length >= PER_TYPE_LIMIT) break;
    const d = quotation.details;
    if (matches([quotation.confirmation?.refNumber, d.companyName, d.fullName, d.email], query)) {
      results.push({
        type: "quotation",
        id: quotation.id,
        title: quotation.confirmation?.refNumber ?? `Request from ${d.companyName}`,
        subtitle: `${d.fullName} · ${quotation.status}`,
        href: `/admin/quotations?q=${encodeURIComponent(d.email)}`,
      });
    }
  }

  // Clients are not a stored entity — they are derived from the contact
  // details on quotations, deduped by email so one company with several
  // requests appears once.
  const seenClients = new Set<string>();
  for (const quotation of quotations) {
    if (seenClients.size >= PER_TYPE_LIMIT) break;
    const d = quotation.details;
    const email = d.email?.toLowerCase();
    if (!email || seenClients.has(email)) continue;
    if (matches([d.fullName, d.email, d.companyName], query)) {
      seenClients.add(email);
      results.push({
        type: "client",
        id: email,
        title: d.fullName || d.companyName,
        subtitle: `${d.companyName} · ${d.email}`,
        href: `/admin/quotations?q=${encodeURIComponent(d.email)}`,
      });
    }
  }

  return results;
}
